Building an embedded chatbot (like a widget or an iframe) that lives on a third-party website _behind a login_ requires a strict security model. You cannot rely on standard browser cookies because of Cross-Origin Resource Sharing (CORS) and third-party cookie restrictions. Instead, you must establish a secure trust relationship between the **Host Website (Third-Party)**, your **Widget/Frontend**, and your **AI Chat Backend**.

Here is the production-ready architecture, authentication flow, and database modeling required to build this securely.

---

## 1. The Core Architecture Diagram

```
+---------------------------+       1. Auth Token Request      +--------------------------+
|  Host App / Third-Party   | -------------------------------> |    Host App Backend      |
|  (User is logged in here) |                                  | (Knows who the user is)  |
+---------------------------+                                  +--------------------------+
       |                                                                    |
       | 3. Render Widget with                                              | 2. Generate Secure Token
       |    Secure JWT/Token                                                |    via Server-to-Server
       v                                                                    v
+---------------------------+       4. Chat Requests & Stream    +--------------------------+
|    Your Chat Widget       | -------------------------------> |     Your Chat Backend    |
| (Embedded iframe/script)  |  (Passes Widget JWT in Header)   |  (Validates token & AI)  |
+---------------------------+                                  +--------------------------+

```

---

## 2. The Authentication Flow (The Most Crucial Part)

Since the user is already authenticated on the third-party site, you must leverage **Token Exchange** so they don't have to log in again.

1. **Token Handshake:** When a user loads the third-party page, the third-party frontend requests a short-lived "Widget Token" from _their own backend_.
2. **Server-to-Server Signing:** The Host App Backend generates a signed JSON Web Token (JWT). They sign it using a **Shared Secret** or a **Private Key** that you provided to them during their developer onboarding.

- _Payload details:_ It should securely contain the `external_user_id`, `tenant_id` (company ID), `user_email`, and an expiration time (e.g., 15 minutes).

3. **Initialization:** The third-party frontend passes this JWT into your embedded widget script:

```javascript
YourChatWidget.init({
  licenseKey: "client_pub_abc123",
  authToken: "EYJ0eXAiOiJKV1QiLC...", // The signed JWT from their backend
});
```

4. **API Authorization:** For every subsequent chat message sent to your backend, your widget attaches this token in the `Authorization: Bearer <Widget_JWT>` header. Your backend validates it using the shared secret.

---

## 3. Revised Database Schema

To support multi-tenancy (multiple third-party clients), your database must isolate data by `tenant_id` (the third-party company) and map their `external_user_id` to your internal systems.

### Tenants Table (The Third-Party Companies)

```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    api_public_key VARCHAR(255) UNIQUE NOT NULL, -- Used in front-end script
    api_secret_hash VARCHAR(255) NOT NULL,       -- Used to verify their server-signed JWTs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

```

### End-Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    external_user_id VARCHAR(255) NOT NULL, -- The ID from the third-party's system
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, external_user_id)     -- Ensures scope isolation
);

```

### Chat Threads Table

```sql
CREATE TABLE chat_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'New Chat',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

```

---

## 4. Modified Endpoint Design for Embedded Widgets

Because it’s an embedded widget, you need endpoints tailored for cross-origin authentication and thread initialization.

### `POST /api/v1/widget/session`

- **Description:** Executed immediately when the widget loads. It exchanges the third-party signed JWT for an internal, short-lived session token (or validates it directly) and sets up the user in your database if they don't exist yet.
- **Headers:** `Authorization: Bearer <Third_Party_Signed_JWT>`
- **Response:** Returns the user's recent chat history or thread configurations.

### `POST /api/v1/widget/threads`

- **Description:** Creates a new chat thread under the authenticated user and tenant scope.
- **Headers:** `Authorization: Bearer <Validated_Token>`

### `POST /api/v1/widget/threads/{thread_id}/messages`

- **Description:** Streams the AI response.
- **Security Check:** Your backend _must_ verify that the `thread_id` belongs to both the `tenant_id` and `user_id` extracted from the token to prevent cross-tenant data leaks.

---

## 5. Security Checklist for the Widget

- **Strict CORS Policies:** Do not use `Access-Control-Allow-Origin: *`. Your backend must look up the incoming `Origin` header, verify it against the allowed domains registered for that `tenant_id` in your database, and explicitly allow only that domain.
- **Iframe Sandbox Attributes (If using iframes):** If embedding via an `<iframe>`, use restrictive sandbox properties to prevent cross-site scripting (XSS) escalations:

```html
<iframe
  src="https://yourchat.com/widget"
  sandbox="allow-scripts allow-same-origin allow-forms"
></iframe>
```

- **Token Expiration:** Ensure the JWTs issued by the third-party server have an expiration time (`exp`) of no more than 15 minutes to reduce replay-attack vectors if intercepted.

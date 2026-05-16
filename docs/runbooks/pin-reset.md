# Runbook: Player PIN Reset

Use this runbook when a player has forgotten their PIN and cannot log in.

---

## Step 1 — Find the player's ID

```bash
curl "https://<your-api-domain>/api/v1/admin/players" \
  -H "Authorization: Bearer <admin-jwt-token>" | \
  jq '.[] | select(.display_name == "<PLAYER_NAME>") | {id, display_name}'
```

---

## Step 2 — Generate a temporary PIN

```bash
curl -X POST "https://<your-api-domain>/api/v1/admin/players/<PLAYER_ID>/reset-pin" \
  -H "Authorization: Bearer <admin-jwt-token>"
```

The response contains a 6-digit temporary PIN:

```json
{"temp_pin": "492817"}
```

---

## Step 3 — Share the temporary PIN securely

Send the temporary PIN to the player via a private message (WhatsApp, iMessage, etc.). Do **not** share it in the group chat.

Instruct the player to:
1. Log in with their display name and the temporary PIN
2. Immediately go to **Settings** and change their PIN to something only they know

---

## Step 4 — Verify (optional)

Ask the player to confirm they can log in successfully and have changed their PIN.

---

## Notes

- The temporary PIN is generated with `secrets.randbelow` — it is cryptographically random.
- The old PIN is overwritten immediately on reset; the player cannot log in with it after step 2.
- There is no PIN history — you can reset as many times as needed.
- If the player has also lost access to the device where the app was installed (and had a session token cached), the session expires within 30 days automatically. If immediate revocation is needed, contact a developer to rotate the JWT secret.

# SSL Certificates

Place your SSL certificates here:
- `cert.pem` — SSL certificate
- `key.pem` — Private key

## Generate self-signed certificates (for development)

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem \
  -subj "/C=FR/ST=Paris/L=Paris/O=ChemStab/CN=localhost"
```

## Production

For production, use Let's Encrypt or your CA's certificates.

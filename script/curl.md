<!-- 회원가입 -->
curl -X POST http://localhost:3000/auth/signup -H "Content-Type: application/json" -d '{"email":"gesazumo@naver.com","password":"12345678"}'

curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password",
    "metadata": {
      "role": "admin"
    }
  }'
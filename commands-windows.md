# Windows PowerShell commands

```powershell
# 1. Extract the ZIP, then enter the project folder
cd pallerlamudi-connect-whatsapp

# 2. Install dependencies
npm install

# 3. Configure environment
Copy-Item .env.example .env.local
notepad .env.local

# 4. Add your Neon DATABASE_URL, then run migration
# The SQL file can also be pasted into Neon SQL Editor:
# drizzle/0001_whatsapp_module.sql

# 5. Start Next.js
npm run dev

# 6. Start n8n in another terminal (Docker Desktop must be running)
$env:N8N_ENCRYPTION_KEY = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
docker compose up -d

# 7. Open local services
Start-Process http://localhost:3000
Start-Process http://localhost:5678
```

For first database setup, run `drizzle/0001_whatsapp_module.sql` in Neon SQL Editor. The included Drizzle migration command is configured for future generated migrations.

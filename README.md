# sgbooked.com

This repository contains a sample ticketing application inspired by large event-booking flows, implemented as a React frontend and a Spring Boot backend.

## Stack

- React with Vite for the booking UI
- Java 21 with Spring Boot for API endpoints
- Oracle XE planned later; the current backend keeps data in memory so the persistence layer can be swapped cleanly

## Features in this scaffold

- Login and profile creation flow
- SMTP-ready email hooks for registration, login, and booking confirmation
- Ball-count human verification after login and again for hold extension
- Admin-controlled seat release
- Venue areas for Stage, Festival, VIP, Group 1, Group 2 Left, and Group 2 Right
- Seat hold timer with 10-minute checkout window and extension flow
- Sample payment form for card, PayNow, GrabPay, and Apple Pay

## Run the frontend

```powershell
cd frontend
npm install
npm run dev
```

## Run both apps

From the repository root, use:

```powershell
.\run.bat
```

This starts the backend and frontend in separate terminal windows using only relative paths from the project root.

## Run the backend

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

The default backend URL is `http://localhost:8080` and the frontend expects the API at `http://localhost:8080/api`.

## Demo admin account

- Username: `ADMIN`
- Password: `ADMIN`

## SMTP configuration

The backend is configured for Gmail SMTP with sender address `sgbooked@gmail.com`.

Set the secret locally before starting the backend:

```powershell
$env:SGBOOKED_GMAIL_FROM="sgbooked@gmail.com"
$env:SGBOOKED_GMAIL_USERNAME="sgbooked@gmail.com"
$env:SGBOOKED_GMAIL_APP_PASSWORD="your-google-app-password"
```

Key settings live in `backend/src/main/resources/application.properties`:

- `sgbooked.mail.enabled=true`
- `sgbooked.mail.from=${SGBOOKED_GMAIL_FROM:sgbooked@gmail.com}`
- `spring.mail.host=smtp.gmail.com`
- `spring.mail.port=587`
- `spring.mail.username=${SGBOOKED_GMAIL_USERNAME:sgbooked@gmail.com}`
- `spring.mail.password=${SGBOOKED_GMAIL_APP_PASSWORD:}`

Do not commit a real Gmail password or app password into source control.

## Oracle XE integration later

The current implementation isolates user, auth-session, and booking state in services. Replacing the in-memory maps with Oracle-backed repositories is the next step once the schema is defined.
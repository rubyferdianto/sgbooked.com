# sgbooked.com Project Brief

## Overview

sgbooked.com is a custom event-ticketing application inspired by the booking flow of major entertainment platforms. The current project delivers a React frontend and Spring Boot backend that cover the main customer journey from sign-in to sample payment.

## Product Direction

- Primary theme uses NUS-inspired blue and orange.
- Frontend is built in React with Vite.
- Backend is built in Java with Spring Boot.
- Oracle XE is the planned database target once the schema is finalized.

## Main User Roles

### Admin

- Login to the platform.
- Release seats so customers can begin selecting inventory.
- Pause sales again if needed.

### Normal User

- Create profile and login.
- Receive email notifications after registration and login.
- Complete a human-verification challenge based on counting balls in highlighted tiles.
- Select seats or standing inventory.
- Review cart, hold seats for 10 minutes, extend hold with another challenge, and complete a sample payment flow.

## Venue Layout

- Stage at the front.
- Festival standing area directly in front of the stage.
- VIP seating after Festival.
- Group 1 seating after VIP.
- Group 2 Left seating block.
- Group 2 Right seating block.

## Inventory Targets

- VIP: 100 seats
- Group 1: 200 seats
- Group 2 Left: 500 seats
- Group 2 Right: 500 seats
- Festival: standing inventory included as a separate zone in the current scaffold

## Booking Flow

1. User registers or logs in.
2. Backend sends an SMTP-backed access notification.
3. User completes a ball-count challenge.
4. User selects available inventory after admin release.
5. Selected seats are held for 10 minutes.
6. Near expiry, the user can request an extension and complete another challenge.
7. User completes a sample payment using credit card, PayNow, GrabPay, or Apple Pay.
8. Backend sends a confirmation notification.

## Current Technical Notes

- Authentication, challenge state, seating inventory, and reservations are currently in memory.
- The service layer is structured so Oracle XE repositories can be added later without rewriting the UI flow.
- Gmail SMTP is configured through environment variables so credentials are not stored in the repository.

## Next Implementation Step

Replace in-memory state with Oracle XE persistence for users, sessions, seats, reservations, and payment records.
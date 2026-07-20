package com.sgbooked.backend.model;

import java.time.Instant;
import java.util.List;

public final class AppModels {

	private AppModels() {
	}

	public enum Role {
		ADMIN,
		USER
	}

	public enum SeatStatus {
		BLOCKED,
		AVAILABLE,
		HELD,
		SOLD
	}

	public enum ZoneType {
		STANDING,
		SEATED
	}

	public enum ReservationStatus {
		HELD,
		PAID,
		EXPIRED
	}

	public enum PaymentMethod {
		CARD,
		PAYNOW,
		GRABPAY,
		APPLEPAY
	}

	public record RegisterRequest(String fullName, String email, String password) {
	}

	public record LoginRequest(String email, String password) {
	}

	public record UserResponse(String fullName, String email, Role role) {
	}

	public record ChallengeTile(int tileNumber, String imageUrl, boolean highlighted) {
	}

	public record HumanChallengeResponse(String challengeId, String prompt, List<ChallengeTile> tiles) {
	}

	public record PendingAuthResponse(String message, String pendingToken, HumanChallengeResponse challenge) {
	}

	public record VerifyHumanRequest(String pendingToken, String challengeId, int answer) {
	}

	public record ChangePasswordRequest(String currentPassword, String newPassword) {
	}

	public record AuthCompleteResponse(String token, UserResponse user) {
	}

	public record ReleaseSeatsRequest(boolean released) {
	}

	public record StandardMessageResponse(String message, boolean released) {
	}

	public record SeatResponse(String seatId, String label, int price, SeatStatus status) {
	}

	public record ZoneResponse(
		String zoneId,
		String label,
		String description,
		String color,
		ZoneType type,
		List<SeatResponse> seats) {
	}

	public record LayoutResponse(
		boolean released,
		int holdMinutes,
		int extensionMinutes,
		List<ZoneResponse> zones) {
	}

	public record ReservationRequest(List<String> seatIds) {
	}

	public record ReservationItemResponse(String seatId, String label, String zoneLabel, int price) {
	}

	public record ReservationResponse(
		String reservationId,
		ReservationStatus status,
		Instant expiresAt,
		List<ReservationItemResponse> items,
		int total) {
	}

	public record ExtensionRequest(String challengeId, int answer) {
	}

	public record PaymentRequest(
		PaymentMethod method,
		String cardHolder,
		String cardNumber,
		String expiryDate,
		String cvv,
		String payNowNumber,
		String walletId) {
	}

	public record PaymentResponse(String message, String reference, List<ReservationItemResponse> items, int total) {
	}

	public static final class UserAccount {

		private final String userId;
		private final String fullName;
		private final String email;
		private final String passwordHash;
		private final Role role;

		public UserAccount(String userId, String fullName, String email, String passwordHash, Role role) {
			this.userId = userId;
			this.fullName = fullName;
			this.email = email;
			this.passwordHash = passwordHash;
			this.role = role;
		}

		public String userId() {
			return userId;
		}

		public String fullName() {
			return fullName;
		}

		public String email() {
			return email;
		}

		public String passwordHash() {
			return passwordHash;
		}

		public Role role() {
			return role;
		}
	}

	public static final class HumanChallenge {

		private final String challengeId;
		private final int expectedAnswer;
		private final Instant expiresAt;
		private final HumanChallengeResponse response;

		public HumanChallenge(
			String challengeId,
			int expectedAnswer,
			Instant expiresAt,
			HumanChallengeResponse response) {
			this.challengeId = challengeId;
			this.expectedAnswer = expectedAnswer;
			this.expiresAt = expiresAt;
			this.response = response;
		}

		public String challengeId() {
			return challengeId;
		}

		public int expectedAnswer() {
			return expectedAnswer;
		}

		public Instant expiresAt() {
			return expiresAt;
		}

		public HumanChallengeResponse response() {
			return response;
		}
	}

	public static final class PendingAuthSession {

		private final String pendingToken;
		private final String userEmail;
		private final String challengeId;
		private final Instant expiresAt;

		public PendingAuthSession(String pendingToken, String userEmail, String challengeId, Instant expiresAt) {
			this.pendingToken = pendingToken;
			this.userEmail = userEmail;
			this.challengeId = challengeId;
			this.expiresAt = expiresAt;
		}

		public String pendingToken() {
			return pendingToken;
		}

		public String userEmail() {
			return userEmail;
		}

		public String challengeId() {
			return challengeId;
		}

		public Instant expiresAt() {
			return expiresAt;
		}
	}

	public static final class SeatInventory {

		private final String seatId;
		private final String label;
		private final String zoneId;
		private final String zoneLabel;
		private final String zoneDescription;
		private final String color;
		private final ZoneType zoneType;
		private final int price;
		private SeatStatus status;
		private String heldByReservationId;

		public SeatInventory(
			String seatId,
			String label,
			String zoneId,
			String zoneLabel,
			String zoneDescription,
			String color,
			ZoneType zoneType,
			int price) {
			this.seatId = seatId;
			this.label = label;
			this.zoneId = zoneId;
			this.zoneLabel = zoneLabel;
			this.zoneDescription = zoneDescription;
			this.color = color;
			this.zoneType = zoneType;
			this.price = price;
			this.status = SeatStatus.AVAILABLE;
		}

		public String seatId() {
			return seatId;
		}

		public String label() {
			return label;
		}

		public String zoneId() {
			return zoneId;
		}

		public String zoneLabel() {
			return zoneLabel;
		}

		public String zoneDescription() {
			return zoneDescription;
		}

		public String color() {
			return color;
		}

		public ZoneType zoneType() {
			return zoneType;
		}

		public int price() {
			return price;
		}

		public SeatStatus status() {
			return status;
		}

		public void status(SeatStatus status) {
			this.status = status;
		}

		public String heldByReservationId() {
			return heldByReservationId;
		}

		public void heldByReservationId(String heldByReservationId) {
			this.heldByReservationId = heldByReservationId;
		}
	}

	public static final class ReservationRecord {

		private final String reservationId;
		private final String userEmail;
		private final List<String> seatIds;
		private final int total;
		private ReservationStatus status;
		private Instant expiresAt;

		public ReservationRecord(
			String reservationId,
			String userEmail,
			List<String> seatIds,
			int total,
			ReservationStatus status,
			Instant expiresAt) {
			this.reservationId = reservationId;
			this.userEmail = userEmail;
			this.seatIds = seatIds;
			this.total = total;
			this.status = status;
			this.expiresAt = expiresAt;
		}

		public String reservationId() {
			return reservationId;
		}

		public String userEmail() {
			return userEmail;
		}

		public List<String> seatIds() {
			return seatIds;
		}

		public int total() {
			return total;
		}

		public ReservationStatus status() {
			return status;
		}

		public void status(ReservationStatus status) {
			this.status = status;
		}

		public Instant expiresAt() {
			return expiresAt;
		}

		public void expiresAt(Instant expiresAt) {
			this.expiresAt = expiresAt;
		}
	}
}

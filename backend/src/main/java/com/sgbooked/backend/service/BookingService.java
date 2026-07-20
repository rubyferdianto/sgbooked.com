package com.sgbooked.backend.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import com.sgbooked.backend.config.SgBookedProperties;
import com.sgbooked.backend.model.AppModels.ExtensionRequest;
import com.sgbooked.backend.model.AppModels.HumanChallengeResponse;
import com.sgbooked.backend.model.AppModels.LayoutResponse;
import com.sgbooked.backend.model.AppModels.PaymentMethod;
import com.sgbooked.backend.model.AppModels.PaymentRequest;
import com.sgbooked.backend.model.AppModels.PaymentResponse;
import com.sgbooked.backend.model.AppModels.ReservationItemResponse;
import com.sgbooked.backend.model.AppModels.ReservationRecord;
import com.sgbooked.backend.model.AppModels.ReservationRequest;
import com.sgbooked.backend.model.AppModels.ReservationResponse;
import com.sgbooked.backend.model.AppModels.ReservationStatus;
import com.sgbooked.backend.model.AppModels.SeatInventory;
import com.sgbooked.backend.model.AppModels.SeatResponse;
import com.sgbooked.backend.model.AppModels.SeatStatus;
import com.sgbooked.backend.model.AppModels.StandardMessageResponse;
import com.sgbooked.backend.model.AppModels.UserAccount;
import com.sgbooked.backend.model.AppModels.ZoneResponse;
import com.sgbooked.backend.model.AppModels.ZoneType;

import jakarta.annotation.PostConstruct;

@Service
public class BookingService {

	private final Map<String, ZoneDefinition> zoneDefinitions = new LinkedHashMap<>();
	private final Map<String, SeatInventory> seatsById = new LinkedHashMap<>();
	private final Map<String, ReservationRecord> reservations = new ConcurrentHashMap<>();

	private final HumanChallengeService humanChallengeService;
	private final NotificationService notificationService;
	private final SgBookedProperties properties;

	private volatile boolean released;

	public BookingService(
		HumanChallengeService humanChallengeService,
		NotificationService notificationService,
		SgBookedProperties properties) {
		this.humanChallengeService = humanChallengeService;
		this.notificationService = notificationService;
		this.properties = properties;
	}

	@PostConstruct
	void initializeVenue() {
		zoneDefinitions.put("FESTIVAL", new ZoneDefinition("FESTIVAL", "Festival", "", "#64748b", ZoneType.STANDING, 300, 98, "FST"));
		zoneDefinitions.put("VIP", new ZoneDefinition("VIP", "VIP", "", "#d97706", ZoneType.SEATED, 100, 288, "VIP"));
		zoneDefinitions.put("GROUP1", new ZoneDefinition("GROUP1", "Group 1", "", "#7c3aed", ZoneType.SEATED, 200, 188, "G1"));
		zoneDefinitions.put("GROUP2_LEFT", new ZoneDefinition("GROUP2_LEFT", "Group 2 Left", "", "#0f766e", ZoneType.SEATED, 500, 128, "L"));
		zoneDefinitions.put("GROUP2_RIGHT", new ZoneDefinition("GROUP2_RIGHT", "Group 2 Right", "", "#2563eb", ZoneType.SEATED, 500, 128, "R"));

		zoneDefinitions.values().forEach(this::seedZone);
	}

	public synchronized LayoutResponse getLayout() {
		releaseExpiredReservations();
		List<ZoneResponse> zones = new ArrayList<>();

		for (ZoneDefinition definition : zoneDefinitions.values()) {
			List<SeatResponse> seats = seatsById.values().stream()
				.filter((seat) -> seat.zoneId().equals(definition.zoneId()))
				.map((seat) -> new SeatResponse(seat.seatId(), seat.label(), seat.price(), displayStatus(seat)))
				.toList();

			zones.add(new ZoneResponse(
				definition.zoneId(),
				definition.label(),
				definition.description(),
				definition.color(),
				definition.zoneType(),
				seats));
		}

		return new LayoutResponse(released, properties.getHoldMinutes(), properties.getExtensionMinutes(), zones);
	}

	public synchronized StandardMessageResponse setReleased(boolean released) {
		this.released = released;
		return new StandardMessageResponse(
			released ? "Seats released. Customers can now make selection." : "Seat sales paused.",
			released);
	}

	public synchronized ReservationResponse reserve(UserAccount user, ReservationRequest request) {
		releaseExpiredReservations();
		ensureReleased();
		List<String> seatIds = request.seatIds();

		if (seatIds == null || seatIds.isEmpty()) {
			throw new ResponseStatusException(BAD_REQUEST, "Select at least one seat or standing pass.");
		}

		List<SeatInventory> seats = new ArrayList<>();
		int total = 0;

		for (String seatId : seatIds) {
			SeatInventory seat = seatsById.get(seatId);
			if (seat == null) {
				throw new ResponseStatusException(NOT_FOUND, "Seat " + seatId + " does not exist.");
			}
			if (seat.status() != SeatStatus.AVAILABLE) {
				throw new ResponseStatusException(CONFLICT, seat.label() + " is no longer available.");
			}
			seats.add(seat);
			total += seat.price();
		}

		String reservationId = UUID.randomUUID().toString();
		Instant expiresAt = Instant.now().plus(properties.getHoldMinutes(), ChronoUnit.MINUTES);
		ReservationRecord reservation = new ReservationRecord(
			reservationId,
			user.email(),
			List.copyOf(seatIds),
			total,
			ReservationStatus.HELD,
			expiresAt);
		reservations.put(reservationId, reservation);

		for (SeatInventory seat : seats) {
			seat.status(SeatStatus.HELD);
			seat.heldByReservationId(reservationId);
		}

		return toReservationResponse(reservation);
	}

	public synchronized HumanChallengeResponse createExtensionChallenge(String reservationId, UserAccount user) {
		ReservationRecord reservation = requireActiveReservation(reservationId, user);
		if (reservation.expiresAt().isBefore(Instant.now())) {
			expireReservation(reservation);
			throw new ResponseStatusException(CONFLICT, "Reservation has already expired.");
		}

		return humanChallengeService.createChallenge(
			"The highlighted tile contains how many balls? Answer correctly to extend your hold.");
	}

	public synchronized ReservationResponse extendReservation(String reservationId, UserAccount user, ExtensionRequest request) {
		ReservationRecord reservation = requireActiveReservation(reservationId, user);
		humanChallengeService.solve(request.challengeId(), request.answer());
		reservation.expiresAt(Instant.now().plus(properties.getExtensionMinutes(), ChronoUnit.MINUTES));
		return toReservationResponse(reservation);
	}

	public synchronized PaymentResponse pay(String reservationId, UserAccount user, PaymentRequest request) {
		ReservationRecord reservation = requireActiveReservation(reservationId, user);

		if (reservation.expiresAt().isBefore(Instant.now())) {
			expireReservation(reservation);
			throw new ResponseStatusException(CONFLICT, "Reservation expired before payment was completed.");
		}

		validatePayment(request);

		for (String seatId : reservation.seatIds()) {
			SeatInventory seat = seatsById.get(seatId);
			seat.status(SeatStatus.SOLD);
			seat.heldByReservationId(null);
		}

		reservation.status(ReservationStatus.PAID);
		reservation.expiresAt(null);
		String reference = "SGB-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

		notificationService.sendAccessNotice(
			user,
			"sgbooked booking confirmed",
			"Your sample booking has been marked paid. Reference: " + reference + ".");

		return new PaymentResponse(
			"Payment accepted. Your sample booking is confirmed.",
			reference,
			reservationItems(reservation),
			reservation.total());
	}

	private ReservationRecord requireActiveReservation(String reservationId, UserAccount user) {
		releaseExpiredReservations();
		ReservationRecord reservation = reservations.get(reservationId);

		if (reservation == null || !reservation.userEmail().equals(user.email())) {
			throw new ResponseStatusException(NOT_FOUND, "Reservation was not found.");
		}

		if (reservation.status() != ReservationStatus.HELD) {
			throw new ResponseStatusException(CONFLICT, "Reservation is no longer active.");
		}

		return reservation;
	}

	private void ensureReleased() {
		if (!released) {
			throw new ResponseStatusException(CONFLICT, "Seats are not released yet. Wait for admin approval.");
		}
	}

	private void validatePayment(PaymentRequest request) {
		if (request == null || request.method() == null) {
			throw new ResponseStatusException(BAD_REQUEST, "Select a payment method.");
		}

		if (request.method() == PaymentMethod.CARD) {
			requireText(request.cardHolder(), "Cardholder name is required.");
			requireText(request.cardNumber(), "Card number is required.");
			requireText(request.expiryDate(), "Expiry date is required.");
			requireText(request.cvv(), "CVV is required.");
			return;
		}

		if (request.method() == PaymentMethod.PAYNOW) {
			requireText(request.payNowNumber(), "PayNow number is required.");
			return;
		}

		requireText(request.walletId(), "Wallet identifier is required.");
	}

	private String requireText(String value, String message) {
		if (!StringUtils.hasText(value)) {
			throw new ResponseStatusException(BAD_REQUEST, message);
		}

		return value.trim();
	}

	private ReservationResponse toReservationResponse(ReservationRecord reservation) {
		return new ReservationResponse(
			reservation.reservationId(),
			reservation.status(),
			reservation.expiresAt(),
			reservationItems(reservation),
			reservation.total());
	}

	private List<ReservationItemResponse> reservationItems(ReservationRecord reservation) {
		return reservation.seatIds().stream()
			.map(seatsById::get)
			.map((seat) -> new ReservationItemResponse(seat.seatId(), seat.label(), seat.zoneLabel(), seat.price()))
			.toList();
	}

	private void releaseExpiredReservations() {
		Instant now = Instant.now();
		reservations.values().stream()
			.filter((reservation) -> reservation.status() == ReservationStatus.HELD)
			.filter((reservation) -> reservation.expiresAt() != null && reservation.expiresAt().isBefore(now))
			.forEach(this::expireReservation);
	}

	private void expireReservation(ReservationRecord reservation) {
		for (String seatId : reservation.seatIds()) {
			SeatInventory seat = seatsById.get(seatId);
			if (seat != null && reservation.reservationId().equals(seat.heldByReservationId())) {
				seat.status(SeatStatus.AVAILABLE);
				seat.heldByReservationId(null);
			}
		}
		reservation.status(ReservationStatus.EXPIRED);
		reservation.expiresAt(null);
	}

	private SeatStatus displayStatus(SeatInventory seat) {
		if (!released && seat.status() == SeatStatus.AVAILABLE) {
			return SeatStatus.BLOCKED;
		}

		return seat.status();
	}

	private void seedZone(ZoneDefinition definition) {
		for (int index = 1; index <= definition.capacity(); index++) {
			String numeric = String.format("%03d", index);
			String label = definition.prefix() + numeric;
			String seatId = definition.zoneId() + "-" + numeric;
			seatsById.put(
				seatId,
				new SeatInventory(
					seatId,
					label,
					definition.zoneId(),
					definition.label(),
					definition.description(),
					definition.color(),
					definition.zoneType(),
					definition.price()));
		}
	}

	private record ZoneDefinition(
		String zoneId,
		String label,
		String description,
		String color,
		ZoneType zoneType,
		int capacity,
		int price,
		String prefix) {
	}
}

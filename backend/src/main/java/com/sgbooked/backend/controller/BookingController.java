package com.sgbooked.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sgbooked.backend.model.AppModels.ExtensionRequest;
import com.sgbooked.backend.model.AppModels.HumanChallengeResponse;
import com.sgbooked.backend.model.AppModels.LayoutResponse;
import com.sgbooked.backend.model.AppModels.PaymentRequest;
import com.sgbooked.backend.model.AppModels.PaymentResponse;
import com.sgbooked.backend.model.AppModels.ReservationRequest;
import com.sgbooked.backend.model.AppModels.ReservationResponse;
import com.sgbooked.backend.model.AppModels.UserAccount;
import com.sgbooked.backend.service.AuthService;
import com.sgbooked.backend.service.BookingService;

@RestController
@RequestMapping("/api/booking")
public class BookingController {

	private final AuthService authService;
	private final BookingService bookingService;

	public BookingController(AuthService authService, BookingService bookingService) {
		this.authService = authService;
		this.bookingService = bookingService;
	}

	@GetMapping("/layout")
	public LayoutResponse layout(@RequestHeader("Authorization") String authorizationHeader) {
		authService.requireSession(authorizationHeader);
		return bookingService.getLayout();
	}

	@PostMapping("/reservations")
	public ReservationResponse reserve(
		@RequestHeader("Authorization") String authorizationHeader,
		@RequestBody ReservationRequest request) {
		UserAccount user = authService.requireCustomer(authorizationHeader);
		return bookingService.reserve(user, request);
	}

	@PostMapping("/reservations/{reservationId}/extension-challenge")
	public HumanChallengeResponse extensionChallenge(
		@RequestHeader("Authorization") String authorizationHeader,
		@PathVariable String reservationId) {
		UserAccount user = authService.requireCustomer(authorizationHeader);
		return bookingService.createExtensionChallenge(reservationId, user);
	}

	@PostMapping("/reservations/{reservationId}/extend")
	public ReservationResponse extend(
		@RequestHeader("Authorization") String authorizationHeader,
		@PathVariable String reservationId,
		@RequestBody ExtensionRequest request) {
		UserAccount user = authService.requireCustomer(authorizationHeader);
		return bookingService.extendReservation(reservationId, user, request);
	}

	@PostMapping("/reservations/{reservationId}/payment")
	public PaymentResponse payment(
		@RequestHeader("Authorization") String authorizationHeader,
		@PathVariable String reservationId,
		@RequestBody PaymentRequest request) {
		UserAccount user = authService.requireCustomer(authorizationHeader);
		return bookingService.pay(reservationId, user, request);
	}
}
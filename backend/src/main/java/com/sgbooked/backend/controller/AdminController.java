package com.sgbooked.backend.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sgbooked.backend.model.AppModels.ReleaseSeatsRequest;
import com.sgbooked.backend.model.AppModels.StandardMessageResponse;
import com.sgbooked.backend.service.AuthService;
import com.sgbooked.backend.service.BookingService;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

	private final AuthService authService;
	private final BookingService bookingService;

	public AdminController(AuthService authService, BookingService bookingService) {
		this.authService = authService;
		this.bookingService = bookingService;
	}

	@PostMapping("/release")
	public StandardMessageResponse releaseSeats(
		@RequestHeader("Authorization") String authorizationHeader,
		@RequestBody ReleaseSeatsRequest request) {
		authService.requireAdmin(authorizationHeader);
		return bookingService.setReleased(request.released());
	}
}
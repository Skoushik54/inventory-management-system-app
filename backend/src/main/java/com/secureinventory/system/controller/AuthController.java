package com.secureinventory.system.controller;

import com.secureinventory.system.dto.InventoryDtos;
import com.secureinventory.system.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody InventoryDtos.LoginRequest loginRequest) {
        String token = authService.login(loginRequest.getUsername(), loginRequest.getPassword());
        InventoryDtos.LoginResponse response = new InventoryDtos.LoginResponse();
        response.setToken(token);
        response.setUsername(loginRequest.getUsername());
        return ResponseEntity.ok(response);
    }
}

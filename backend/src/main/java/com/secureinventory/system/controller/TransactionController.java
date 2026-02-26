package com.secureinventory.system.controller;

import com.secureinventory.system.dto.InventoryDtos;
import com.secureinventory.system.entity.Transaction;
import com.secureinventory.system.service.TransactionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    @Autowired
    private TransactionService transactionService;

    @PostMapping("/issue")
    public ResponseEntity<Transaction> issueProduct(@RequestBody InventoryDtos.IssueRequest request) {
        return ResponseEntity.ok(transactionService.issueProduct(request));
    }

    @PostMapping("/return/{id}")
    public ResponseEntity<Void> returnProduct(@PathVariable Long id, @RequestParam(defaultValue = "1") int quantity) {
        transactionService.returnProduct(id, quantity);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/pending")
    public ResponseEntity<List<Transaction>> getPending() {
        return ResponseEntity.ok(transactionService.getPendingReturns());
    }

    @GetMapping("/all")
    public ResponseEntity<List<Transaction>> getAll() {
        return ResponseEntity.ok(transactionService.getAllTransactions());
    }
}

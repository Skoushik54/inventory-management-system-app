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
    public ResponseEntity<List<Transaction>> issueBatch(@RequestBody InventoryDtos.IssueRequest request) {
        return ResponseEntity.ok(transactionService.issueBatch(request));
    }

    @PostMapping("/return/{id}")
    public ResponseEntity<Void> returnProduct(
            @PathVariable Long id, 
            @RequestParam(defaultValue = "1") int quantity,
            @RequestParam(required = false) Transaction.Status status) {
        transactionService.returnProduct(id, quantity, status);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/return-detailed/{id}")
    public ResponseEntity<Void> returnProductDetailed(
            @PathVariable Long id,
            @RequestBody com.secureinventory.system.dto.InventoryDtos.DetailedReturnRequest request) {
        transactionService.returnProductDetailed(id, request);
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

    @GetMapping
    public ResponseEntity<List<Transaction>> getRoot() {
        return ResponseEntity.ok(transactionService.getAllTransactions());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTransaction(@PathVariable Long id) {
        transactionService.deleteTransaction(id);
        return ResponseEntity.ok().build();
    }
}

package com.secureinventory.system.service;

import com.secureinventory.system.entity.Officer;
import com.secureinventory.system.entity.Product;
import com.secureinventory.system.entity.Transaction;
import com.secureinventory.system.repository.OfficerRepository;
import com.secureinventory.system.repository.ProductRepository;
import com.secureinventory.system.repository.TransactionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class TransactionService {

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private OfficerRepository officerRepository;

    @Autowired
    private AuditLogService auditLogService;

    @Transactional
    public Transaction issueProduct(com.secureinventory.system.dto.InventoryDtos.IssueRequest request) {
        Product product = productRepository.findByBarcode(request.getBarcode())
                .orElseThrow(() -> new RuntimeException("Product not found"));

        Officer officer = officerRepository.findByBadgeNumber(request.getBadgeNumber())
                .orElseGet(() -> {
                    Officer newOfficer = new Officer();
                    newOfficer.setBadgeNumber(request.getBadgeNumber());
                    return newOfficer;
                });
        
        // Update officer details
        if (request.getName() != null) officer.setName(request.getName());
        if (request.getDepartment() != null) officer.setDepartment(request.getDepartment());
        if (request.getPhone() != null) officer.setPhone(request.getPhone());
        if (request.getOthers() != null) officer.setOthers(request.getOthers());
        
        officerRepository.save(officer);

        if (product.getAvailableQuantity() < request.getQuantity()) {
            throw new RuntimeException("Insufficient stock");
        }

        product.setAvailableQuantity(product.getAvailableQuantity() - request.getQuantity());
        productRepository.save(product);

        Transaction transaction = new Transaction();
        transaction.setProduct(product);
        transaction.setOfficer(officer);
        transaction.setQuantity(request.getQuantity());
        transaction.setPurpose(request.getPurpose());
        transaction.setStatus(Transaction.Status.ISSUED);

        Transaction saved = transactionRepository.save(transaction);
        auditLogService.log("STOCK_ISSUE",
                "Issued " + request.getQuantity() + " of " + product.getName() + " to " + officer.getName() + " (ID: " + officer.getBadgeNumber() + ")");
        return saved;
    }

    @Transactional
    public void returnProduct(Long transactionId, int quantityToReturn) {
        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));

        if (transaction.getStatus() == Transaction.Status.RETURNED) {
            throw new RuntimeException("Already fully returned");
        }

        int remainingToReturn = transaction.getQuantity() - transaction.getReturnedQuantity();
        if (quantityToReturn > remainingToReturn) {
            throw new RuntimeException("Return quantity exceeds remaining issued amount (" + remainingToReturn + ")");
        }

        Product product = transaction.getProduct();
        product.setAvailableQuantity(product.getAvailableQuantity() + quantityToReturn);
        productRepository.save(product);

        transaction.setReturnedQuantity(transaction.getReturnedQuantity() + quantityToReturn);
        transaction.setReturnedAt(LocalDateTime.now());
        
        if (transaction.getReturnedQuantity() >= transaction.getQuantity()) {
            transaction.setStatus(Transaction.Status.RETURNED);
        } else {
            transaction.setStatus(Transaction.Status.PARTIALLY_RETURNED);
        }
        
        transactionRepository.save(transaction);

        auditLogService.log("STOCK_RETURN", "Returned " + quantityToReturn + " units of " + product.getName()
                + " from " + transaction.getOfficer().getName() + ". Total returned: " + transaction.getReturnedQuantity() + "/" + transaction.getQuantity());
    }

    public List<Transaction> getPendingReturns() {
        return transactionRepository.findAll().stream()
                .filter(t -> t.getStatus() != Transaction.Status.RETURNED)
                .toList();
    }

    public List<Transaction> getAllTransactions() {
        return transactionRepository.findAll();
    }
}

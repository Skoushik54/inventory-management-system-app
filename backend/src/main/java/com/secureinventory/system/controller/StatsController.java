package com.secureinventory.system.controller;

import com.secureinventory.system.dto.InventoryDtos;
import com.secureinventory.system.entity.ProductItem;
import com.secureinventory.system.repository.ProductItemRepository;
import com.secureinventory.system.repository.ProductRepository;
import com.secureinventory.system.repository.TransactionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/stats")
public class StatsController {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductItemRepository productItemRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @GetMapping("/summary")
    public ResponseEntity<InventoryDtos.SummaryResponse> getSummary() {
        InventoryDtos.SummaryResponse res = new InventoryDtos.SummaryResponse();
        res.setTotalProducts(productRepository.count());
        res.setAvailableStock(productItemRepository.countByStatus(ProductItem.Status.AVAILABLE));
        res.setIssuedItems(productItemRepository.countByStatus(ProductItem.Status.ISSUED));
        res.setPendingReturns(transactionRepository.countByStatus(com.secureinventory.system.entity.Transaction.Status.ISSUED) + transactionRepository.countByStatus(com.secureinventory.system.entity.Transaction.Status.PARTIALLY_RETURNED));
        res.setDamagedItems(productItemRepository.countByStatus(ProductItem.Status.DAMAGED) + productItemRepository.countByStatus(ProductItem.Status.PARTIALLY_RETURNED));
        return ResponseEntity.ok(res);
    }

    @GetMapping("/damaged")
    public ResponseEntity<List<ProductItem>> getDamagedItems() {
        return ResponseEntity.ok(productItemRepository.findByStatusIn(java.util.Arrays.asList(ProductItem.Status.DAMAGED, ProductItem.Status.PARTIALLY_RETURNED)));
    }

    @PostMapping("/restore/{id}")
    public ResponseEntity<Void> restoreItem(@PathVariable Long id) {
        ProductItem item = productItemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Item not found"));
        item.setStatus(ProductItem.Status.AVAILABLE);
        productItemRepository.save(item);
        
        // Update product counts
        com.secureinventory.system.entity.Product product = item.getProduct();
        product.setAvailableQuantity((int)productItemRepository.countByProductIdAndStatus(product.getId(), ProductItem.Status.AVAILABLE));
        productRepository.save(product);
        
        return ResponseEntity.ok().build();
    }
}

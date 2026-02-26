package com.secureinventory.system.controller;

import com.secureinventory.system.entity.Product;
import com.secureinventory.system.service.InventoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    @Autowired
    private InventoryService inventoryService;

    @PostMapping("/products")
    public ResponseEntity<Product> addProduct(@RequestBody Product product) {
        return ResponseEntity.ok(inventoryService.addProduct(product));
    }

    @GetMapping("/products")
    public ResponseEntity<List<Product>> getAllProducts() {
        return ResponseEntity.ok(inventoryService.getAllProducts());
    }

    @GetMapping("/products/{barcode}")
    public ResponseEntity<Product> getProduct(@PathVariable String barcode) {
        return ResponseEntity.ok(inventoryService.getProductByBarcode(barcode));
    }

    @PutMapping("/products/{id}")
    public ResponseEntity<Product> updateProduct(@PathVariable Long id, @RequestBody Product product) {
        return ResponseEntity.ok(inventoryService.updateProduct(id, product));
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        inventoryService.deleteProduct(id);
        return ResponseEntity.ok().build();
    }

    private static final String EXCEL_PATH = "C:/Users/samba/Downloads/inventory-management-system-main/inventory-management-system-main/COM EQP 25-02-2026.xlsx";

    @GetMapping("/open-local")
    public ResponseEntity<Void> openLocalExcel() {
        inventoryService.openLocalExcel(EXCEL_PATH);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/sync")
    public ResponseEntity<Void> syncFromExcel() {
        inventoryService.syncFromExcel(EXCEL_PATH);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/upload-sync")
    public ResponseEntity<String> uploadAndSync(@RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        try {
            java.io.File dest = new java.io.File(EXCEL_PATH);
            file.transferTo(dest);
            inventoryService.syncFromExcel(EXCEL_PATH);
            return ResponseEntity.ok("Successfully uploaded and synced.");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Failed to upload: " + e.getMessage());
        }
    }

    @PostMapping("/sync-cloud")
    public ResponseEntity<String> syncCloud(@RequestBody java.util.Map<String, String> payload) {
        String link = payload.get("cloudLink");
        if (link == null || link.isEmpty()) return ResponseEntity.badRequest().body("Link is missing");
        try {
            inventoryService.syncFromCloudLink(link, EXCEL_PATH);
            return ResponseEntity.ok("Cloud Sync Successful!");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Cloud Sync Failed: " + e.getMessage());
        }
    }

    @GetMapping("/download-excel")
    public ResponseEntity<org.springframework.core.io.Resource> downloadExcel() {
        try {
            java.nio.file.Path path = java.nio.file.Paths.get("C:/Users/samba/Downloads/inventory-management-system-main/inventory-management-system-main/COM EQP 25-02-2026.xlsx");
            org.springframework.core.io.Resource resource = new org.springframework.core.io.UrlResource(path.toUri());
            return ResponseEntity.ok()
                    .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + resource.getFilename() + "\"")
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/export")
    public void exportInventory(jakarta.servlet.http.HttpServletResponse response) {
        try {
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setHeader("Content-Disposition", "attachment; filename=inventory_export.xlsx");
            inventoryService.exportInventory(response.getOutputStream());
        } catch (Exception e) {
            response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }
}

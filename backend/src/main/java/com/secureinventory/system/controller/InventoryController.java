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

    @GetMapping("/products/id/{id}")
    public ResponseEntity<Product> getProductById(@PathVariable Long id) {
        return ResponseEntity.ok(inventoryService.getProductById(id));
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

    @GetMapping("/items/{barcode}")
    public ResponseEntity<com.secureinventory.system.entity.ProductItem> getItem(@PathVariable String barcode) {
        return ResponseEntity.ok(inventoryService.getItemByBarcode(barcode));
    }

    @PostMapping("/products/{id}/items")
    public ResponseEntity<Void> addItems(@PathVariable Long id, @RequestBody java.util.List<java.util.Map<String, String>> itemData) {
        inventoryService.addItemsToProduct(id, itemData);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/products/{id}/spare-parts")
    public ResponseEntity<Void> addSparePart(@PathVariable Long id, @RequestBody java.util.Map<String, String> payload) {
        inventoryService.addSparePartToProduct(id, payload.get("name"));
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/items/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable Long id) {
        inventoryService.deleteProductItem(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/items/{id}")
    public ResponseEntity<com.secureinventory.system.entity.ProductItem> updateItem(@PathVariable Long id, @RequestBody com.secureinventory.system.entity.ProductItem details) {
        return ResponseEntity.ok(inventoryService.updateProductItem(id, details));
    }

    @DeleteMapping("/spare-parts/{id}")
    public ResponseEntity<Void> deleteSparePart(@PathVariable Long id) {
        inventoryService.deleteSparePart(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/set-excel-path")
    public ResponseEntity<Void> setExcelPath(@RequestBody java.util.Map<String, String> payload) {
        String path = payload.get("path");
        if (path != null) {
            inventoryService.setExcelPath(path);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.badRequest().build();
    }

    @GetMapping("/open-local")
    public ResponseEntity<java.util.Map<String, String>> openLocalExcel() {
        String currentPath = inventoryService.getExcelPath();
        inventoryService.openLocalExcel(currentPath);
        java.util.Map<String, String> response = new java.util.HashMap<>();
        response.put("message", "Attempting to open: " + currentPath);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/sync")
    public ResponseEntity<Void> syncFromExcel() {
        inventoryService.syncFromExcel(inventoryService.getExcelPath());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/upload-sync")
    public ResponseEntity<String> uploadAndSync(@RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        try {
            java.io.File dest = new java.io.File(inventoryService.getExcelPath());
            file.transferTo(dest);
            inventoryService.syncFromExcel(inventoryService.getExcelPath());
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
            inventoryService.syncFromCloudLink(link, inventoryService.getExcelPath());
            return ResponseEntity.ok("Cloud Sync Successful!");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Cloud Sync Failed: " + e.getMessage());
        }
    }

    @GetMapping("/download-excel")
    public ResponseEntity<org.springframework.core.io.Resource> downloadExcel() {
        try {
            java.nio.file.Path path = java.nio.file.Paths.get(inventoryService.getExcelPath());
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

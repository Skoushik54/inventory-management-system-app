package com.secureinventory.system.service;

import com.secureinventory.system.entity.Product;
import com.secureinventory.system.entity.ProductItem;
import com.secureinventory.system.entity.SparePart;
import com.secureinventory.system.repository.ProductItemRepository;
import com.secureinventory.system.repository.ProductRepository;
import com.secureinventory.system.repository.SparePartRepository;
import com.secureinventory.system.repository.TransactionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.io.File;
import java.io.FileInputStream;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.awt.Desktop;

@Service
public class InventoryService {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductItemRepository productItemRepository;

    @Autowired
    private SparePartRepository sparePartRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private AuditLogService auditLogService;

    private static final Logger logger = LoggerFactory.getLogger(InventoryService.class);

    // The single source of truth path
    private String excelPath = "C:/Users/samba/Downloads/inventory-management-system-main/inventory-management-system-main/COM EQP 25-02-2026.xlsx";

    public String getExcelPath() { return excelPath; }
    public void setExcelPath(String path) { this.excelPath = path; }

    private long lastSyncedTimestamp = 0;

    @jakarta.annotation.PostConstruct
    public void init() {
        refreshFromExcel();
    }

    public void refreshFromExcel() {
        System.out.println(">>> [AUTO-SYNC] Synchronizing with local Excel file...");
        try {
            File file = new File(excelPath);
            if (file.exists()) {
                syncFromExcel(excelPath);
                lastSyncedTimestamp = file.lastModified();
                System.out.println(">>> [AUTO-SYNC] Success! Last modified: " + new java.util.Date(lastSyncedTimestamp));
            }
        } catch (Exception e) {
            System.err.println(">>> [AUTO-SYNC] Error: " + e.getMessage());
        }
    }

    public void syncIfModified() {
        File file = new File(excelPath);
        if (file.exists() && file.lastModified() > lastSyncedTimestamp) {
            System.out.println(">>> [AUTO-SYNC] Detected change in Excel file. Re-syncing...");
            refreshFromExcel();
        }
    }

    @Transactional
    public Product addProduct(Product product) {
        if (productRepository.findByBarcode(product.getBarcode()).isPresent()) {
            throw new RuntimeException("Barcode already exists");
        }
        Product saved = productRepository.save(product);
        syncProductItems(saved);
        auditLogService.log("PRODUCT_ADD", "Added product: " + product.getName() + " and auto-generated units");
        saved = productRepository.save(saved);
        updateExcelOnDisk();
        return saved;
    }

    public List<Product> getAllProducts() {
        syncIfModified(); // Transparently sync if Excel was edited manually
        return productRepository.findAllByOrderByOrderIndexAsc();
    }

    public Product getProductByBarcode(String barcode) {
        return productRepository.findByBarcode(barcode)
                .orElseThrow(() -> new RuntimeException("Product not found"));
    }

    @Transactional
    public void updateStock(Long productId, int totalQuantityChange) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Product not found"));

        product.setTotalQuantity(product.getTotalQuantity() + totalQuantityChange);
        product.setAvailableQuantity(product.getAvailableQuantity() + totalQuantityChange);

        if (product.getAvailableQuantity() < 0) {
            throw new RuntimeException("Insufficient stock");
        }

        productRepository.save(product);
    }

    @Transactional
    public Product updateProduct(Long id, Product details) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Product not found"));
        product.setName(details.getName());
        product.setBarcode(details.getBarcode());
        product.setTotalQuantity(details.getTotalQuantity());
        product.setImageUrl(details.getImageUrl());
        
        syncProductItems(product);
        Product saved = productRepository.save(product);
        updateExcelOnDisk();
        return saved;
    }

    private void syncProductItems(Product product) {
        long currentCount = productItemRepository.countByProductId(product.getId());
        int targetCount = product.getTotalQuantity();
        
        logger.info("Syncing Product {}: Current={}, Target={}", product.getName(), currentCount, targetCount);

        if (currentCount < targetCount) {
            java.util.List<ProductItem> batch = new java.util.ArrayList<>();
            for (long i = currentCount + 1; i <= targetCount; i++) {
                ProductItem item = new ProductItem();
                String suffix = String.format("%03d", i);
                item.setBarcode(product.getBarcode() + "-" + suffix);
                item.setProduct(product);
                item.setStatus(ProductItem.Status.AVAILABLE);
                batch.add(item);
                
                if (batch.size() >= 100) {
                    productItemRepository.saveAll(batch);
                    batch.clear();
                }
            }
            if (!batch.isEmpty()) {
                productItemRepository.saveAll(batch);
            }
            productItemRepository.flush();
        } else if (currentCount > targetCount) {
            // Remove items if stock decreased, but ONLY available ones
            int diff = (int)(currentCount - targetCount);
            java.util.List<ProductItem> availableItems = productItemRepository.findByProductIdAndStatus(product.getId(), ProductItem.Status.AVAILABLE);
            
            // Sort available items by barcode descending to remove highest numbers first
            availableItems.sort((a, b) -> b.getBarcode().compareTo(a.getBarcode()));
            
            int toRemove = Math.min(diff, availableItems.size());
            for (int i = 0; i < toRemove; i++) {
                productItemRepository.delete(availableItems.get(i));
            }
            productItemRepository.flush(); // Crucial to update counts
            logger.info("Reduced stock for {}: requested to remove {}, actually removed {} available items.", product.getName(), diff, toRemove);
        }
        
        long finalCount = productItemRepository.countByProductId(product.getId());
        long finalAvail = productItemRepository.countByProductIdAndStatus(product.getId(), ProductItem.Status.AVAILABLE);
        
        product.setTotalQuantity((int) finalCount);
        product.setAvailableQuantity((int) finalAvail);
        
        logger.info("Final Sync for {}: Total={}, Available={}", product.getName(), finalCount, finalAvail);
    }

    @Transactional
    public void deleteProduct(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Product not found"));

        // Check if any item is not AVAILABLE
        long busyItems = productItemRepository.countByProductIdAndStatus(id, ProductItem.Status.AVAILABLE);
        long totalItems = productItemRepository.countByProductId(id);
        
        if (totalItems > busyItems) {
            throw new RuntimeException("Cannot delete: " + (totalItems - busyItems) + " items are still Issued or Damaged. Please return them first.");
        }

        // 1. Delete associated transactions first (History)
        transactionRepository.deleteByProductItemProductId(id);
        
        // 2. Cascade takes care of items and spare parts via productRepository.delete (if configured)
        // But to be safe and clean, we handle audit and excel before/after
        productRepository.delete(product);
        updateExcelOnDisk();
        auditLogService.log("PRODUCT_DELETE", "Deleted product: " + product.getName());
    }

    public Product getProductById(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Product not found with id: " + id));
        
        // Removed auto-refresh items check to allow manual unit management
        
        return product;
    }

    public ProductItem getItemByBarcode(String barcode) {
        return productItemRepository.findByBarcode(barcode)
                .orElseThrow(() -> new RuntimeException("Item not found"));
    }

    @Transactional
    public ProductItem updateProductItem(Long id, ProductItem details) {
        ProductItem item = productItemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Item not found"));
        
        // Check barcode uniqueness if changed
        if (!item.getBarcode().equals(details.getBarcode())) {
            if (productItemRepository.findByBarcode(details.getBarcode()).isPresent()) {
                throw new RuntimeException("Barcode already exists");
            }
        }
        
        item.setBarcode(details.getBarcode());
        item.setSerialNumber(details.getSerialNumber());
        item.setStatus(details.getStatus());
        
        return productItemRepository.save(item);
    }

    @Transactional
    public void addItemsToProduct(Long productId, List<java.util.Map<String, String>> itemData) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Product not found"));
        
        for (java.util.Map<String, String> data : itemData) {
            String bc = data.get("barcode");
            String sn = data.get("serialNumber");

            if (productItemRepository.findByBarcode(bc).isPresent()) {
                throw new RuntimeException("Item with ID " + bc + " already exists");
            }

            ProductItem item = new ProductItem();
            item.setBarcode(bc);
            item.setSerialNumber(sn);
            item.setProduct(product);
            item.setStatus(ProductItem.Status.AVAILABLE);
            
            if (product.getItems() != null) {
                product.getItems().add(item);
            }
            
            productItemRepository.save(item);
        }
        
        product.setTotalQuantity((int) productItemRepository.countByProductId(productId));
        product.setAvailableQuantity((int) productItemRepository.countByProductIdAndStatus(productId, ProductItem.Status.AVAILABLE));
        productRepository.save(product);
        updateExcelOnDisk();
    }

    @Transactional
    public void addSparePartToProduct(Long productId, String name) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Product not found"));
        
        SparePart part = new SparePart();
        part.setName(name);
        part.setProduct(product);
        
        if (product.getSpareParts() != null) {
            product.getSpareParts().add(part);
        }
        
        sparePartRepository.save(part);
        productRepository.save(product);
    }

    @Transactional
    public void deleteProductItem(Long id) {
        logger.info("Attempting to delete product item: {}", id);
        ProductItem item = productItemRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Item not found with id: " + id));
        
        Product product = item.getProduct();
        
        // Vital: Remove from parent collection for JPA sync
        if (product.getItems() != null) {
            product.getItems().remove(item);
        }
        
        productItemRepository.delete(item);
        
        // Sync quantities
        product.setTotalQuantity(product.getItems().size());
        product.setAvailableQuantity((int)product.getItems().stream()
                .filter(i -> i.getStatus() == ProductItem.Status.AVAILABLE).count());
        productRepository.save(product);
        
        logger.info("Successfully deleted product item {} and updated quantities for {}", id, product.getName());
        auditLogService.log("ITEM_DELETE", "Deleted item: " + item.getBarcode() + " from product: " + product.getName());
    }

    @Transactional
    public void deleteSparePart(Long id) {
        logger.info("Attempting to delete spare part: {}", id);
        SparePart part = sparePartRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Spare part not found with id: " + id));
        
        Product product = part.getProduct();
        if (product.getSpareParts() != null) {
            product.getSpareParts().remove(part);
        }
        
        sparePartRepository.delete(part);
        logger.info("Successfully deleted spare part {} from product {}", id, product.getName());
        auditLogService.log("SPARE_DELETE", "Deleted spare part: " + part.getName() + " from product: " + product.getName());
    }

    public void exportInventory(java.io.OutputStream outputStream) throws java.io.IOException {
        List<Product> products = productRepository.findAllByOrderByOrderIndexAsc();
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Inventory");
            
            // Grand Headings
            Row titleRow1 = sheet.createRow(0);
            titleRow1.createCell(0).setCellValue("Greyhounds");
            sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, 4));

            Row titleRow2 = sheet.createRow(1);
            titleRow2.createCell(0).setCellValue("Telangana");
            sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(1, 1, 0, 4));
            
            // Header Row
            Row header = sheet.createRow(3);
            header.createCell(0).setCellValue("Name of the Equipment");
            header.createCell(1).setCellValue("QR Data (Barcode)");
            header.createCell(2).setCellValue("As per Ledger (Total Stock)");

            int rowIdx = 4;
            for (Product p : products) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(p.getName());
                row.createCell(1).setCellValue(p.getBarcode());
                row.createCell(2).setCellValue(p.getTotalQuantity());
            }

            // Auto-size columns for better visibility
            for (int i = 0; i < 3; i++) sheet.autoSizeColumn(i);

            workbook.write(outputStream);
        }
    }

    public void updateExcelOnDisk() {
        try (java.io.FileOutputStream fos = new java.io.FileOutputStream(excelPath)) {
            exportInventory(fos);
            File file = new File(excelPath);
            if (file.exists()) {
                lastSyncedTimestamp = file.lastModified();
            }
            System.out.println(">>> [AUTO-SAVE] Local Excel file updated at: " + excelPath);
        } catch (Exception e) {
            System.err.println(">>> [AUTO-SAVE] Warning: Could not update local Excel file. It might be open in another program.");
        }
    }

    @Transactional
    public void syncFromCloudLink(String link, String localPath) throws Exception {
        String downloadUrl = link;
        
        // Transform the OneDrive link to a direct download link if necessary
        if (link.contains("1drv.ms") || link.contains("onedrive.live.com")) {
            if (link.contains("?")) downloadUrl = link.substring(0, link.indexOf('?')) + "?download=1";
            else downloadUrl = link + "?download=1";
        } else if (link.contains("drive.google.com")) {
            // Very simplified GDrive export transform (requires file ID)
            String[] parts = link.split("/");
            for (int i=0; i<parts.length; i++) {
                if (parts[i].equals("d") && i+1 < parts.length) {
                    downloadUrl = "https://docs.google.com/spreadsheets/d/" + parts[i+1] + "/export?format=xlsx";
                    break;
                }
            }
        }

        StringBuilder log = new StringBuilder("CLOUD SYNC START: " + new java.util.Date() + "\n");
        log.append("Original Link: ").append(link).append("\n");
        log.append("Download URL mapped to: ").append(downloadUrl).append("\n");
        
        try {
            java.net.URL url = new java.net.URL(downloadUrl);
            java.net.HttpURLConnection httpConn = (java.net.HttpURLConnection) url.openConnection();
            httpConn.setInstanceFollowRedirects(true);
            int responseCode = httpConn.getResponseCode();
            
            // Follow up to 3 redirects manually if HttpURLConnection doesn't do HTTPS to HTTP etc.
            if (responseCode == java.net.HttpURLConnection.HTTP_MOVED_TEMP || responseCode == java.net.HttpURLConnection.HTTP_MOVED_PERM || responseCode == java.net.HttpURLConnection.HTTP_SEE_OTHER) {
                String newUrl = httpConn.getHeaderField("Location");
                log.append("Redirected to: ").append(newUrl).append("\n");
                httpConn = (java.net.HttpURLConnection) new java.net.URL(newUrl).openConnection();
                responseCode = httpConn.getResponseCode();
            }

            if (responseCode == java.net.HttpURLConnection.HTTP_OK) {
                java.io.InputStream is = httpConn.getInputStream();
                java.io.FileOutputStream fos = new java.io.FileOutputStream(localPath);
                byte[] buffer = new byte[4096];
                int bytesRead = -1;
                while ((bytesRead = is.read(buffer)) != -1) {
                    fos.write(buffer, 0, bytesRead);
                }
                fos.close();
                is.close();
                log.append("File successfully downloaded and saved to: ").append(localPath).append("\n");
                writeSyncLog(log);
                
                // Trigger regular sync now that file is on disk
                syncFromExcel(localPath);
            } else {
                log.append("ERROR: Cloud download failed. Server responded with HTTP code: ").append(responseCode).append("\n");
                writeSyncLog(log);
                throw new RuntimeException("Server replied HTTP code: " + responseCode);
            }
        } catch (Exception e) {
            log.append("FATAL CLOUD DOWNLOAD ERROR: ").append(e.getClass().getName()).append(" - ").append(e.getMessage()).append("\n");
            writeSyncLog(log);
            throw e;
        }
    }

    @Transactional
    public void syncFromExcel(String filePath) {
        StringBuilder log = new StringBuilder();
        log.append("SYNC START: ").append(new java.util.Date()).append("\n");
        try {
            File file = new File(filePath);
            if (!file.exists()) {
                log.append("ERROR: File not found at ").append(filePath).append("\n");
                writeSyncLog(log);
                return;
            }

            try (FileInputStream fis = new FileInputStream(file);
                 Workbook workbook = new XSSFWorkbook(fis)) {
                
                Map<String, Product> uniqueProducts = new java.util.LinkedHashMap<>();
                int activeSheetIndex = workbook.getActiveSheetIndex();
                log.append("Scanning PRIMARY Sheet (Active Index ").append(activeSheetIndex).append("): ").append(workbook.getSheetName(activeSheetIndex)).append("\n");

                Sheet sheet = workbook.getSheetAt(activeSheetIndex);
                int lastRow = sheet.getLastRowNum();
                if (lastRow < 0) {
                    log.append("ERROR: Active sheet is empty.\n");
                    writeSyncLog(log);
                    return;
                }

                int colName = -1, colBarcode = -1, colTotal = -1, colAvail = -1, colSNo = -1;
                int startRow = -1;

                // Log first 5 rows for debug
                for (int i=0; i<Math.min(5, lastRow+1); i++) {
                    Row r = sheet.getRow(i);
                    if (r != null) {
                        log.append("  ROW ").append(i).append(": ");
                        for (int k=0; k<=Math.min(15, r.getLastCellNum()); k++) {
                            log.append("[").append(getStringValue(r.getCell(k)).trim()).append("] ");
                        }
                        log.append("\n");
                    }
                }

                // Header detection scanning first 50 rows
                for (int i = 0; i <= Math.min(50, lastRow); i++) {
                    Row row = sheet.getRow(i);
                    if (row == null) continue;
                    
                    int tempName = -1, tempBarcode = -1, tempTotal = -1, tempAvail = -1, tempSNo = -1;
                    int matches = 0;

                    for (int j = 0; j < row.getLastCellNum(); j++) {
                        String val = getStringValue(row.getCell(j)).toLowerCase().trim();
                        if (val.isEmpty()) continue;

                        if ((val.contains("name") || val.contains("equipment") || val.contains("item") || val.contains("particular")) && !val.contains("s.no") && !val.contains("s. no") && !val.contains("reserved") && !val.contains("communication") && !val.contains("date")) {
                            if (tempName == -1) { tempName = j; matches++; }
                        } else if (val.contains("barcode") || val.contains("qr") || val.contains("code") || val.contains("ref")) {
                            if (tempBarcode == -1) { tempBarcode = j; matches++; }
                        } else if (val.contains("as per led") || val.contains("per led") || val.contains("ledger") || val.contains("tot stock")) {
                            if (tempTotal == -1 || val.contains("ledger")) { tempTotal = j; matches++; }
                        } else if (val.contains("total") && !val.contains("loan") && !val.contains("dept")) {
                            if (tempTotal == -1) { tempTotal = j; matches++; }
                        } else if (val.contains("on hand") || val.contains("present") || val.contains("available") || val.contains("in hand")) {
                            if (tempAvail == -1) { tempAvail = j; matches++; }
                        } else if (val.contains("s.no") || val.contains("s. no") || val.contains("sl.") || val.equals("no") || val.equals("sn")) {
                            if (tempSNo == -1) { tempSNo = j; }
                        }
                    }


                    if (tempName != -1 && matches >= 2) {
                        startRow = i + 1;
                        colName = tempName;
                        colBarcode = tempBarcode;
                        colTotal = tempTotal;
                        colAvail = tempAvail;
                        colSNo = tempSNo;
                        log.append("  Headers confirmed at Row ").append(i).append("\n");
                        break;
                    }
                }

                // Fallback for standard layout (aligns with our 3-column export)
                if (startRow == -1) {
                    startRow = 4; colName = 0; colBarcode = 1; colTotal = 2; colAvail = -1;
                    log.append("  No headers detected. Using ledger standard (Col 0: Name, Col 1: Barcode, Col 2: Ledger).\n");
                }

                log.append("  Processing Rows from ").append(startRow).append(" to ").append(lastRow).append("\n");

                int rowCount = 0;
                int updatedCount = 0;
                int addedCount = 0;

                for (int i = startRow; i <= lastRow; i++) {
                    Row row = sheet.getRow(i);
                    if (row == null) continue;
                    String name = getStringValue(row.getCell(colName)).trim();
                    
                    if (name.isEmpty() || name.length() < 3 || name.matches("\\d+")) continue;
                    if (name.toUpperCase().contains("COMMUNICATION") || name.toUpperCase().contains("DATE") || 
                        name.toUpperCase().contains("S. NO") || name.toUpperCase().contains("LOAN") || 
                        name.toUpperCase().contains("TRANSACTION") || name.toUpperCase().contains("TOTAL") ||
                        name.toUpperCase().contains("PARTICULAR") || name.toLowerCase().equals("workshop") ||
                        name.toLowerCase().contains("reserved") || name.toLowerCase().contains("thermal") ||
                        name.toLowerCase().contains("box equipment")) continue;

                    String barcode = colBarcode != -1 ? getStringValue(row.getCell(colBarcode)).trim() : "";
                    if (barcode.isEmpty() || barcode.equalsIgnoreCase("S. NO") || barcode.equalsIgnoreCase("S.NO")) {
                        barcode = name.toUpperCase().replaceAll("[^A-Z0-9]", "-");
                    }

                    int total = colTotal != -1 ? (int) getNumericValue(row.getCell(colTotal)) : 0;
                    
                    // IF we have an S.No, use it as a suffix for the barcode to match existing items
                    String sNoValue = "";
                    if (colSNo != -1) {
                        sNoValue = getStringValue(row.getCell(colSNo)).trim();
                        if (!sNoValue.isEmpty() && sNoValue.matches("\\d+")) {
                            // If user already had a barcode from a dedicated column, we keep it. 
                            // Otherwise, generate NAME-SNO to match existing pattern.
                            if (colBarcode == -1 || barcode.equalsIgnoreCase(name.toUpperCase().replaceAll("[^A-Z0-9]", "-"))) {
                                barcode = name.toUpperCase().replaceAll("[^A-Z0-9]", "-") + "-" + sNoValue;
                            }
                        }
                    }

                    Product product = productRepository.findByBarcode(barcode).orElse(null);
                    if (product == null) {
                        product = new Product();
                        product.setBarcode(barcode);
                        product.setAvailableQuantity(0); // Will be updated by syncProductItems
                        addedCount++;
                    } else {
                        updatedCount++;
                    }

                    product.setName(name);
                    product.setTotalQuantity(total); // "As per ledger"
                    product.setStatus(Product.Status.ACTIVE);
                    product.setOrderIndex(rowCount++);
                    
                    Product saved = productRepository.save(product);
                    
                    // We DO NOT call syncProductItems(saved) here anymore because the user 
                    // wants to manage custom IDs manually on the units page.
                    // Instead, we just update the available quantity field to match existing DB items.
                    long finalAvail = productItemRepository.countByProductIdAndStatus(saved.getId(), ProductItem.Status.AVAILABLE);
                    saved.setAvailableQuantity((int) finalAvail);
                    productRepository.save(saved);
                    
                    log.append("    -> Sync: [").append(name).append("] (Total: ").append(total).append(")\n");
                }

                log.append("SUCCESS: Processed ").append(rowCount).append(" items. Added: ").append(addedCount).append(", Updated: ").append(updatedCount).append("\n");
            }
        } catch (Exception e) {
            log.append("FATAL ERROR: ").append(e.getClass().getName()).append(": ").append(e.getMessage()).append("\n");
        }
        writeSyncLog(log);
    }

    private void writeSyncLog(StringBuilder log) {
        try (java.io.PrintWriter out = new java.io.PrintWriter(new java.io.FileWriter("sync_debug.txt", true))) {
            out.println(log.toString());
            out.println("--------------------------------------------------");
        } catch (Exception ex) {}
    }

    public void openLocalExcel(String filePath) {
        try {
            File file = new File(filePath);
            if (!file.exists()) throw new RuntimeException("Excel file not found at " + filePath);
            
            if (Desktop.isDesktopSupported()) {
                Desktop.getDesktop().open(file);
            } else {
                Runtime.getRuntime().exec("cmd /c start \"\" \"" + filePath + "\"");
            }
        } catch (Exception e) {
            throw new RuntimeException("Could not open Excel: " + e.getMessage());
        }
    }

    private String getStringValue(Cell cell) {
        if (cell == null) return "";
        if (cell.getCellType() == CellType.STRING) return cell.getStringCellValue();
        if (cell.getCellType() == CellType.NUMERIC) return String.valueOf((long)cell.getNumericCellValue());
        return "";
    }

    private double getNumericValue(Cell cell) {
        if (cell == null) return 0;
        if (cell.getCellType() == CellType.NUMERIC) return cell.getNumericCellValue();
        if (cell.getCellType() == CellType.STRING) {
            try { return Double.parseDouble(cell.getStringCellValue()); } catch (Exception e) { return 0; }
        }
        return 0;
    }
}

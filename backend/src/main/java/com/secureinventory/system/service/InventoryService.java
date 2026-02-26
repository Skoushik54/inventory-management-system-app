package com.secureinventory.system.service;

import com.secureinventory.system.entity.Product;
import com.secureinventory.system.repository.ProductRepository;
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
import java.awt.Desktop;

@Service
public class InventoryService {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private AuditLogService auditLogService;

    // The single source of truth path
    private static final String EXCEL_PATH = "C:/Users/samba/Downloads/inventory-management-system-main/inventory-management-system-main/COM EQP 25-02-2026.xlsx";

    private long lastSyncedTimestamp = 0;

    @jakarta.annotation.PostConstruct
    public void init() {
        refreshFromExcel();
    }

    public void refreshFromExcel() {
        System.out.println(">>> [AUTO-SYNC] Synchronizing with local Excel file...");
        try {
            File file = new File(EXCEL_PATH);
            if (file.exists()) {
                syncFromExcel(EXCEL_PATH);
                lastSyncedTimestamp = file.lastModified();
                System.out.println(">>> [AUTO-SYNC] Success! Last modified: " + new java.util.Date(lastSyncedTimestamp));
            }
        } catch (Exception e) {
            System.err.println(">>> [AUTO-SYNC] Error: " + e.getMessage());
        }
    }

    public void syncIfModified() {
        File file = new File(EXCEL_PATH);
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
        auditLogService.log("PRODUCT_ADD",
                "Added product: " + product.getName() + " with barcode: " + product.getBarcode());
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
        product.setAvailableQuantity(details.getAvailableQuantity());
        product.setImageUrl(details.getImageUrl());
        Product saved = productRepository.save(product);
        return saved;
    }

    @Transactional
    public void deleteProduct(Long id) {
        productRepository.deleteById(id);
        auditLogService.log("PRODUCT_DELETE", "Deleted product ID: " + id);
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
            header.createCell(1).setCellValue("QR Data");
            header.createCell(2).setCellValue("Total Stock");
            header.createCell(3).setCellValue("On Hand (Present Stock)");
            header.createCell(4).setCellValue("Status");

            int rowIdx = 4;
            for (Product p : products) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(p.getName());
                row.createCell(1).setCellValue(p.getBarcode());
                row.createCell(2).setCellValue(p.getTotalQuantity());
                row.createCell(3).setCellValue(p.getAvailableQuantity());
                row.createCell(4).setCellValue(p.getStatus().name());
            }

            // Auto-size columns for better visibility
            for (int i = 0; i < 5; i++) sheet.autoSizeColumn(i);

            workbook.write(outputStream);
        }
    }

    public void updateExcelOnDisk() {
        try (java.io.FileOutputStream fos = new java.io.FileOutputStream(EXCEL_PATH)) {
            exportInventory(fos);
            System.out.println(">>> [AUTO-SAVE] Local Excel file updated at: " + EXCEL_PATH);
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

                int colName = -1, colBarcode = -1, colTotal = -1, colAvail = -1;
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
                    
                    int tempName = -1, tempBarcode = -1, tempTotal = -1, tempAvail = -1;
                    int matches = 0;

                    for (int j = 0; j < row.getLastCellNum(); j++) {
                        String val = getStringValue(row.getCell(j)).toLowerCase().trim();
                        if (val.isEmpty()) continue;

                        if ((val.contains("name") || val.contains("equipment") || val.contains("item")) && !val.contains("s.no") && !val.contains("s. no") && !val.contains("particulars") && !val.contains("reserved")) {
                            if (tempName == -1) { tempName = j; matches++; }
                        } else if (val.contains("barcode") || val.contains("qr") || val.contains("code") || val.contains("ref")) {
                            if (tempBarcode == -1) { tempBarcode = j; matches++; }
                        } else if (val.contains("ledger") || val.contains("as per ledger")) {
                            tempTotal = j; matches++; // Override any existing 'total' column
                        } else if (val.contains("total") || (val.contains("stock") && !val.contains("hand") && !val.contains("available"))) {
                            if (tempTotal == -1) { tempTotal = j; matches++; }
                        } else if (val.contains("available") || val.contains("hand") || val.contains("present") || val.contains("current")) {
                            if (tempAvail == -1) { tempAvail = j; matches++; }
                        }
                    }

                    if (tempName != -1 && matches >= 2) {
                        startRow = i + 1;
                        colName = tempName;
                        colBarcode = tempBarcode;
                        colTotal = tempTotal;
                        colAvail = tempAvail;
                        log.append("  Headers confirmed at Row ").append(i).append("\n");
                        break;
                    }
                }

                // Fallback for standard layout
                if (startRow == -1) {
                    startRow = 2; colName = 2; colBarcode = 1; colTotal = 8; colAvail = 9;
                    log.append("  No headers detected. Using ledger standard (Col 2: Name, Col 8: Total Stock).\n");
                }

                log.append("  Processing Rows from ").append(startRow).append(" to ").append(lastRow).append("\n");

                for (int i = startRow; i <= lastRow; i++) {
                    Row row = sheet.getRow(i);
                    if (row == null) continue;
                    String name = getStringValue(row.getCell(colName)).trim();
                    
                    // Filter out non-equipment rows (titles, empty rows, notes)
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
                    int avail = colAvail != -1 ? (int) getNumericValue(row.getCell(colAvail)) : total;

                    // Skip if both quantities are zero and name is generic
                    if (total == 0 && avail == 0 && name.length() < 5) continue;

                    if (!uniqueProducts.containsKey(barcode)) {
                        Product p = new Product();
                        p.setName(name);
                        p.setBarcode(barcode);
                        p.setTotalQuantity(total);
                        p.setAvailableQuantity(avail);
                        p.setStatus(Product.Status.ACTIVE);
                        uniqueProducts.put(barcode, p);
                        log.append("    -> Imported: [").append(name).append("] (Total: ").append(total).append(", Avail: ").append(avail).append(")\n");
                    }
                }

                if (!uniqueProducts.isEmpty()) {
                    int idx = 0;
                    for (Product p : uniqueProducts.values()) {
                        p.setOrderIndex(idx++);
                    }
                    productRepository.deleteAll();
                    productRepository.saveAll(uniqueProducts.values());
                    log.append("SUCCESS: Imported ").append(uniqueProducts.size()).append(" equipments from Active sheet.\n");
                } else {
                    log.append("WARNING: No equipments found in active sheet.\n");
                }
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

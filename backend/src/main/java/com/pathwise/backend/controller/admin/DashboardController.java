package com.pathwise.backend.controller.admin;

import com.pathwise.backend.dto.DashboardStatsDto;
import com.pathwise.backend.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/dashboard")
@RequiredArgsConstructor
@CrossOrigin
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping
    public ResponseEntity<DashboardStatsDto> getStats() {
        return ResponseEntity.ok(dashboardService.getDashboardStats());
    }
}


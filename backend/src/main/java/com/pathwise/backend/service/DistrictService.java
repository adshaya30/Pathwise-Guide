package com.pathwise.backend.service;

import com.pathwise.backend.entity.District;
import com.pathwise.backend.repository.DistrictRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DistrictService {

    private final DistrictRepository districtRepository;

    public List<District> getAllDistricts() {
        return districtRepository.findAllByOrderByNameAsc();
    }

    public District getDistrictById(UUID id) {
        return districtRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("District not found: " + id));
    }

    @Transactional
    public District createDistrict(District district) {
        return districtRepository.save(district);
    }

    @Transactional
    public District updateDistrict(UUID id, District updated) {
        District existing = getDistrictById(id);
        existing.setCode(updated.getCode());
        existing.setName(updated.getName());
        existing.setProvince(updated.getProvince());
        existing.setHasDisadvantage(updated.getHasDisadvantage());
        return districtRepository.save(existing);
    }

    @Transactional
    public void deleteDistrict(UUID id) {
        districtRepository.deleteById(id);
    }
}


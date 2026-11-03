package com.tracking.repository;

import com.tracking.model.ProjectEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjectRepository extends JpaRepository<ProjectEntity, Long> {
    List<ProjectEntity> findAllByWorkspace_IdOrderByNameAsc(Long workspaceId);
    java.util.Optional<ProjectEntity> findByIdAndWorkspace_Id(Long id, Long workspaceId);
    boolean existsByProjectKey(String projectKey);
}

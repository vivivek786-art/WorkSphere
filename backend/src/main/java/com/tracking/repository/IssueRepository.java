package com.tracking.repository;

import com.tracking.model.IssueEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface IssueRepository extends JpaRepository<IssueEntity, Long> {
    @Query("select distinct issue from IssueEntity issue left join fetch issue.assignees "
            + "where issue.project.id = :projectId order by issue.issueNumber asc")
    List<IssueEntity> findAllByProject_IdOrderByIssueNumberAsc(Long projectId);

    @Query("select distinct issue from IssueEntity issue left join fetch issue.assignees "
            + "where issue.id = :id and issue.project.id = :projectId")
    Optional<IssueEntity> findByIdAndProject_Id(Long id, Long projectId);

    @Query("select coalesce(max(issue.issueNumber), 0) + 1 from IssueEntity issue where issue.project.id = :projectId")
    Long nextIssueNumber(@Param("projectId") Long projectId);
}

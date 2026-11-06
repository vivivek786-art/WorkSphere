package com.tracking.repository;

import com.tracking.model.IssueCommentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IssueCommentRepository extends JpaRepository<IssueCommentEntity, Long> {
    List<IssueCommentEntity> findAllByIssue_IdOrderByCreatedAtAscIdAsc(Long issueId);
}

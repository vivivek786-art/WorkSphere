package com.tracking.model;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "issue_comments")
public class IssueCommentEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "issue_id", nullable = false)
    private IssueEntity issue;

    @Column(nullable = false, length = 12)
    private String thread;

    @Column(nullable = false, length = 4000)
    private String body;

    @Column(name = "author_name", nullable = false, length = 100)
    private String authorName;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected IssueCommentEntity() {
    }

    public IssueCommentEntity(IssueEntity issue, String thread, String body, String authorName) {
        this.issue = issue;
        this.thread = thread;
        this.body = body;
        this.authorName = authorName;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public String getThread() {
        return thread;
    }

    public String getBody() {
        return body;
    }

    public String getAuthorName() {
        return authorName;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}

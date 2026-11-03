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
import java.time.LocalDate;

@Entity
@Table(name = "issues")
public class IssueEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "issue_key", nullable = false, unique = true, length = 24)
    private String issueKey;

    @Column(name = "issue_number", nullable = false)
    private Long issueNumber;

    @Column(nullable = false, length = 120)
    private String summary;

    @Column(length = 2000)
    private String description;

    @Column(name = "issue_type", nullable = false, length = 30)
    private String type;

    @Column(nullable = false, length = 40)
    private String status;

    @Column(nullable = false, length = 30)
    private String priority;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private ProjectEntity project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_id")
    private MemberEntity assignee;

    protected IssueEntity() {
    }

    public IssueEntity(String issueKey, Long issueNumber, String summary, String description,
                       String type, String status, String priority, ProjectEntity project,
                       MemberEntity assignee, LocalDate startDate, LocalDate dueDate) {
        this.issueKey = issueKey;
        this.issueNumber = issueNumber;
        this.summary = summary;
        this.description = description;
        this.type = type;
        this.status = status;
        this.priority = priority;
        this.project = project;
        this.assignee = assignee;
        this.startDate = startDate;
        this.dueDate = dueDate;
    }

    public Long getId() {
        return id;
    }

    public String getIssueKey() {
        return issueKey;
    }

    public Long getIssueNumber() {
        return issueNumber;
    }

    public String getSummary() {
        return summary;
    }

    public String getDescription() {
        return description;
    }

    public String getType() {
        return type;
    }

    public String getStatus() {
        return status;
    }

    public String getPriority() {
        return priority;
    }

    public ProjectEntity getProject() {
        return project;
    }

    public MemberEntity getAssignee() {
        return assignee;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void update(String summary, String description, String type, String status,
                       String priority, MemberEntity assignee, LocalDate startDate, LocalDate dueDate) {
        this.summary = summary;
        this.description = description;
        this.type = type;
        this.status = status;
        this.priority = priority;
        this.assignee = assignee;
        this.startDate = startDate;
        this.dueDate = dueDate;
    }
}

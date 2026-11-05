package com.tracking.api;

import com.tracking.model.IssueEntity;
import com.tracking.model.MemberEntity;
import com.tracking.model.ProjectEntity;
import com.tracking.model.AccountEntity;
import com.tracking.model.WorkspaceEntity;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.AssertTrue;
import javax.validation.constraints.Email;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public final class ApiModels {
    private ApiModels() {
    }

    public static class ProjectRequest {
        @NotBlank
        public String name;
    }

    public static class MemberRequest {
        @NotBlank
        public String name;
    }

    public static class AccountRequest {
        @NotBlank
        @Email
        @Size(max = 254)
        public String username;
        @NotBlank
        @Size(max = 100)
        public String fullName;
        @Size(max = 128)
        public String password;
        @NotBlank
        public String role;
        public boolean enabled = true;
    }

    public static class WorkspaceRequest {
        @NotBlank
        @Size(max = 80)
        public String name;
        public List<Long> accountIds = new ArrayList<>();
    }

    public static class IssueRequest {
        @NotBlank
        public String summary;
        public String description;
        @NotBlank
        public String type;
        @NotBlank
        public String status;
        @NotBlank
        public String priority;
        public Long assigneeId;
        public LocalDateTime startDate;
        public LocalDateTime dueDate;

        @AssertTrue(message = "Start date and time must be on or before due date and time.")
        public boolean isDateRangeValid() {
            return startDate == null || dueDate == null || !startDate.isAfter(dueDate);
        }
    }

    public static class ProjectResponse {
        public final Long id;
        public final String name;
        public final String key;

        public ProjectResponse(ProjectEntity project) {
            this.id = project.getId();
            this.name = project.getName();
            this.key = project.getProjectKey();
        }
    }

    public static class MemberResponse {
        public final Long id;
        public final String name;
        public final String initials;

        public MemberResponse(MemberEntity member) {
            this.id = member.getId();
            this.name = member.getName();
            this.initials = member.getInitials();
        }
    }

    public static class AccountResponse {
        public final Long id;
        public final String username;
        public final String fullName;
        public final String role;
        public final boolean enabled;

        public AccountResponse(AccountEntity account) {
            this.id = account.getId();
            this.username = account.getUsername();
            this.fullName = account.getFullName();
            this.role = account.getRole();
            this.enabled = account.isEnabled();
        }
    }

    public static class WorkspaceResponse {
        public final Long id;
        public final String name;

        public WorkspaceResponse(WorkspaceEntity workspace) {
            this.id = workspace.getId();
            this.name = workspace.getName();
        }
    }

    public static class AdminWorkspaceResponse extends WorkspaceResponse {
        public final List<Long> accountIds;

        public AdminWorkspaceResponse(WorkspaceEntity workspace) {
            this(workspace, true);
        }

        public AdminWorkspaceResponse(WorkspaceEntity workspace, boolean includeSuperadmins) {
            super(workspace);
            this.accountIds = new ArrayList<>();
            workspace.getAccounts().stream()
                    .filter(account -> includeSuperadmins || !"SUPERADMIN".equals(account.getRole()))
                    .forEach(account -> accountIds.add(account.getId()));
        }
    }

    public static class IssueResponse {
        public final Long id;
        public final String key;
        public final String summary;
        public final String description;
        public final String type;
        public final String status;
        public final String priority;
        public final Long assigneeId;
        public final LocalDateTime startDate;
        public final LocalDateTime dueDate;

        public IssueResponse(IssueEntity issue) {
            this.id = issue.getId();
            this.key = issue.getIssueKey();
            this.summary = issue.getSummary();
            this.description = issue.getDescription();
            this.type = issue.getType();
            this.status = issue.getStatus();
            this.priority = issue.getPriority();
            this.assigneeId = issue.getAssignee() == null ? null : issue.getAssignee().getId();
            this.startDate = issue.getStartDate();
            this.dueDate = issue.getDueDate();
        }
    }
}

package com.tracking.api;

import com.tracking.config.WorkspaceAccessService;
import com.tracking.model.AccountEntity;
import com.tracking.model.IssueCommentEntity;
import com.tracking.model.IssueEntity;
import com.tracking.model.ProjectEntity;
import com.tracking.model.WorkspaceEntity;
import com.tracking.repository.AccountRepository;
import com.tracking.repository.IssueCommentRepository;
import com.tracking.repository.IssueRepository;
import com.tracking.repository.ProjectRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import javax.validation.Valid;
import java.util.List;
import java.util.Arrays;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/common/api/v1/projects/{projectId}/issues/{issueId}/comments")
public class IssueCommentController {
    private static final List<String> THREADS = Arrays.asList("DEVELOPER", "TESTER");

    private final WorkspaceAccessService workspaceAccess;
    private final ProjectRepository projects;
    private final IssueRepository issues;
    private final IssueCommentRepository comments;
    private final AccountRepository accounts;

    public IssueCommentController(WorkspaceAccessService workspaceAccess, ProjectRepository projects,
                                  IssueRepository issues, IssueCommentRepository comments,
                                  AccountRepository accounts) {
        this.workspaceAccess = workspaceAccess;
        this.projects = projects;
        this.issues = issues;
        this.comments = comments;
        this.accounts = accounts;
    }

    @GetMapping
    public List<ApiModels.IssueCommentResponse> getComments(
            @PathVariable Long projectId, @PathVariable Long issueId,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            Authentication authentication) {
        requireIssue(projectId, issueId, workspaceId, authentication);
        return comments.findAllByIssue_IdOrderByCreatedAtAscIdAsc(issueId).stream()
                .map(ApiModels.IssueCommentResponse::new)
                .collect(Collectors.toList());
    }

    @PostMapping
    public ApiModels.IssueCommentResponse addComment(
            @PathVariable Long projectId, @PathVariable Long issueId,
            @Valid @RequestBody ApiModels.IssueCommentRequest request,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            Authentication authentication) {
        IssueEntity issue = requireIssue(projectId, issueId, workspaceId, authentication);
        if (!THREADS.contains(request.thread)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Comment thread must be DEVELOPER or TESTER.");
        }
        AccountEntity author = accounts.findByUsernameIgnoreCase(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Signed-in account not found."));
        IssueCommentEntity comment = new IssueCommentEntity(issue, request.thread, request.body.trim(),
                author.getFullName());
        return new ApiModels.IssueCommentResponse(comments.save(comment));
    }

    private IssueEntity requireIssue(Long projectId, Long issueId, Long workspaceId,
                                     Authentication authentication) {
        WorkspaceEntity workspace = workspaceAccess.requireWorkspace(workspaceId, authentication);
        ProjectEntity project = projects.findByIdAndWorkspace_Id(projectId, workspace.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found."));
        return issues.findByIdAndProject_Id(issueId, project.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Issue not found."));
    }
}

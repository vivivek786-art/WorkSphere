package com.tracking.api;

import com.tracking.config.WorkspaceAccessService;
import com.tracking.model.IssueEntity;
import com.tracking.model.MemberEntity;
import com.tracking.model.ProjectEntity;
import com.tracking.model.WorkspaceEntity;
import com.tracking.repository.IssueRepository;
import com.tracking.repository.MemberRepository;
import com.tracking.repository.ProjectRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import javax.validation.Valid;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Validated
@RestController
@RequestMapping("/common/api/v1")
public class TrackingController {
    private static final List<String> ISSUE_TYPES = Arrays.asList("Task", "Story", "Bug");
    private static final List<String> STATUSES = Arrays.asList("To Do", "In Progress", "Done");
    private static final List<String> PRIORITIES = Arrays.asList("Highest", "High", "Medium", "Low");

    private final ProjectRepository projects;
    private final MemberRepository members;
    private final IssueRepository issues;
    private final WorkspaceAccessService workspaceAccess;

    public TrackingController(ProjectRepository projects, MemberRepository members, IssueRepository issues,
                              WorkspaceAccessService workspaceAccess) {
        this.projects = projects;
        this.members = members;
        this.issues = issues;
        this.workspaceAccess = workspaceAccess;
    }

    @GetMapping("/metadata")
    public Map<String, List<String>> getMetadata() {
        Map<String, List<String>> metadata = new LinkedHashMap<>();
        metadata.put("types", ISSUE_TYPES);
        metadata.put("statuses", STATUSES);
        metadata.put("priorities", PRIORITIES);
        return metadata;
    }

    @GetMapping("/projects")
    public List<ApiModels.ProjectResponse> getProjects(
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            Authentication authentication) {
        WorkspaceEntity workspace = workspaceAccess.requireWorkspace(workspaceId, authentication);
        return projects.findAllByWorkspace_IdOrderByNameAsc(workspace.getId()).stream()
                .map(ApiModels.ProjectResponse::new)
                .collect(Collectors.toList());
    }

    @PostMapping("/projects")
    public ApiModels.ProjectResponse createProject(@Valid @RequestBody ApiModels.ProjectRequest request,
                                                    @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
                                                    Authentication authentication) {
        WorkspaceEntity workspace = workspaceAccess.requireWorkspace(workspaceId, authentication);
        String key = createProjectKey(request.name);
        return new ApiModels.ProjectResponse(projects.save(new ProjectEntity(request.name.trim(), key, workspace)));
    }

    @GetMapping("/members")
    public List<ApiModels.MemberResponse> getMembers(
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            Authentication authentication) {
        WorkspaceEntity workspace = workspaceAccess.requireWorkspace(workspaceId, authentication);
        return members.findAllByWorkspace_IdOrderByNameAsc(workspace.getId()).stream()
                .map(ApiModels.MemberResponse::new)
                .collect(Collectors.toList());
    }

    @PostMapping("/members")
    public ApiModels.MemberResponse createMember(@Valid @RequestBody ApiModels.MemberRequest request,
                                                  @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
                                                  Authentication authentication) {
        WorkspaceEntity workspace = workspaceAccess.requireWorkspace(workspaceId, authentication);
        String name = request.name.trim().replaceAll("\\s+", " ");
        String initials = Arrays.stream(name.split(" "))
                .limit(2)
                .map(part -> part.substring(0, 1).toUpperCase(Locale.ROOT))
                .collect(Collectors.joining());
        return new ApiModels.MemberResponse(members.save(new MemberEntity(name, initials, workspace)));
    }

    @GetMapping("/projects/{projectId}/issues")
    public List<ApiModels.IssueResponse> getIssues(@PathVariable Long projectId,
                                                   @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
                                                   Authentication authentication) {
        WorkspaceEntity workspace = workspaceAccess.requireWorkspace(workspaceId, authentication);
        requireProject(projectId, workspace.getId());
        return issues.findAllByProject_IdOrderByIssueNumberAsc(projectId).stream()
                .map(ApiModels.IssueResponse::new)
                .collect(Collectors.toList());
    }

    @PostMapping("/projects/{projectId}/issues")
    public ApiModels.IssueResponse createIssue(@PathVariable Long projectId,
                                               @Valid @RequestBody ApiModels.IssueRequest request,
                                               @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
                                               Authentication authentication) {
        WorkspaceEntity workspace = workspaceAccess.requireWorkspace(workspaceId, authentication);
        ProjectEntity project = requireProject(projectId, workspace.getId());
        validateIssueValues(request);
        Long issueNumber = issues.nextIssueNumber(projectId);
        MemberEntity assignee = findAssignee(request.assigneeId, workspace.getId());
        IssueEntity issue = new IssueEntity(project.getProjectKey() + "-" + issueNumber, issueNumber,
                request.summary.trim(), normalizeDescription(request.description), request.type,
                request.status, request.priority, project, assignee, request.startDate, request.dueDate);
        return new ApiModels.IssueResponse(issues.save(issue));
    }

    @PutMapping("/projects/{projectId}/issues/{issueId}")
    public ApiModels.IssueResponse updateIssue(@PathVariable Long projectId, @PathVariable Long issueId,
                                               @Valid @RequestBody ApiModels.IssueRequest request,
                                               @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
                                               Authentication authentication) {
        WorkspaceEntity workspace = workspaceAccess.requireWorkspace(workspaceId, authentication);
        requireProject(projectId, workspace.getId());
        validateIssueValues(request);
        IssueEntity issue = issues.findByIdAndProject_Id(issueId, projectId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Issue not found."));
        issue.update(request.summary.trim(), normalizeDescription(request.description), request.type,
                request.status, request.priority, findAssignee(request.assigneeId, workspace.getId()),
                request.startDate, request.dueDate);
        return new ApiModels.IssueResponse(issues.save(issue));
    }

    @DeleteMapping("/projects/{projectId}/issues/{issueId}")
    public ResponseEntity<Void> deleteIssue(@PathVariable Long projectId, @PathVariable Long issueId,
                                            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
                                            Authentication authentication) {
        WorkspaceEntity workspace = workspaceAccess.requireWorkspace(workspaceId, authentication);
        requireProject(projectId, workspace.getId());
        IssueEntity issue = issues.findByIdAndProject_Id(issueId, projectId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Issue not found."));
        issues.delete(issue);
        return ResponseEntity.noContent().build();
    }

    private ProjectEntity requireProject(Long id, Long workspaceId) {
        return projects.findByIdAndWorkspace_Id(id, workspaceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found."));
    }

    private MemberEntity findAssignee(Long id, Long workspaceId) {
        if (id == null) return null;
        return members.findByIdAndWorkspace_Id(id, workspaceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assignee not found."));
    }

    private void validateIssueValues(ApiModels.IssueRequest request) {
        if (!ISSUE_TYPES.contains(request.type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported issue type.");
        }
        if (!STATUSES.contains(request.status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported issue status.");
        }
        if (!PRIORITIES.contains(request.priority)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported issue priority.");
        }
    }

    private String normalizeDescription(String description) {
        return description == null ? "" : description.trim();
    }

    private String createProjectKey(String name) {
        String normalized = Normalizer.normalize(name, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]", "");
        String base = normalized.substring(0, Math.min(4, normalized.length()));
        if (base.isEmpty()) base = "PROJ";
        String candidate = base;
        int suffix = 2;
        while (projects.existsByProjectKey(candidate)) {
            candidate = base.substring(0, Math.min(base.length(), 4 - String.valueOf(suffix).length()))
                    + suffix++;
        }
        return candidate;
    }
}

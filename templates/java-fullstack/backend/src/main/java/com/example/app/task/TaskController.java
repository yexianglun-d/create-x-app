package com.example.app.task;

import com.example.app.common.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    public ApiResponse<List<Task>> listTasks() {
        return ApiResponse.ok(taskService.listTasks(), "loaded");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Task> createTask(@Valid @RequestBody CreateTaskRequest request) {
        return ApiResponse.ok(taskService.createTask(request), "created");
    }
}

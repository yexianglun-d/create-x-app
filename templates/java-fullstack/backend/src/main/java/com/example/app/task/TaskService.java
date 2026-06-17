package com.example.app.task;

import jakarta.annotation.PostConstruct;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TaskService {

    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    @PostConstruct
    @Transactional
    public void seedDefaults() {
        if (taskRepository.count() > 0) {
            return;
        }

        taskRepository.saveAll(List.of(
            new Task("完成需求分析文档", "张三", TaskStatus.IN_PROGRESS, Priority.HIGH, "整理需求清单并撰写分析报告", "今天 17:00"),
            new Task("设计系统架构方案", "李四", TaskStatus.REVIEW, Priority.MEDIUM, "完成技术选型和架构设计", "明天 10:30"),
            new Task("编写单元测试", "王五", TaskStatus.TODO, Priority.LOW, "覆盖核心业务逻辑的测试用例", "周五")
        ));
    }

    public List<Task> listTasks() {
        return taskRepository.findAll()
            .stream()
            .sorted(Comparator.comparing(Task::getCreatedAt).reversed())
            .toList();
    }

    @Transactional
    public Task createTask(CreateTaskRequest request) {
        Task task = new Task(
            request.title(),
            request.assignee(),
            TaskStatus.TODO,
            Priority.fromValue(request.priority()),
            request.description(),
            request.dueAt()
        );

        return taskRepository.save(task);
    }
}

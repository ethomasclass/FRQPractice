CREATE TABLE `ai_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`response_id` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`response_id`) REFERENCES `responses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_feedback_response_id_unique` ON `ai_feedback` (`response_id`);--> statement-breakpoint
CREATE TABLE `ai_marks` (
	`id` text PRIMARY KEY NOT NULL,
	`response_id` text NOT NULL,
	`part_id` text NOT NULL,
	`earned` integer NOT NULL,
	`criterion_code` text DEFAULT '' NOT NULL,
	`quote` text DEFAULT '' NOT NULL,
	`justification` text DEFAULT '' NOT NULL,
	`confidence` real DEFAULT 0 NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`response_id`) REFERENCES `responses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`part_id`) REFERENCES `rubric_parts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_marks_response_part_idx` ON `ai_marks` (`response_id`,`part_id`);--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`section_id` text NOT NULL,
	`title` text NOT NULL,
	`intro` text DEFAULT '' NOT NULL,
	`stimulus_text` text DEFAULT '' NOT NULL,
	`stimulus_image_url` text DEFAULT '' NOT NULL,
	`time_limit_minutes` integer DEFAULT 25 NOT NULL,
	`reviews_per_response` integer DEFAULT 4 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source` text DEFAULT 'teacher' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assignments_section_idx` ON `assignments` (`section_id`);--> statement-breakpoint
CREATE TABLE `calibration_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`points_agreed` integer DEFAULT 0 NOT NULL,
	`points_judged` integer DEFAULT 0 NOT NULL,
	`reviews_assigned` integer DEFAULT 0 NOT NULL,
	`reviews_completed` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calibration_assignment_reviewer_idx` ON `calibration_scores` (`assignment_id`,`reviewer_id`);--> statement-breakpoint
CREATE TABLE `exemplars` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`year` integer,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `final_marks` (
	`id` text PRIMARY KEY NOT NULL,
	`response_id` text NOT NULL,
	`part_id` text NOT NULL,
	`earned` integer NOT NULL,
	`source` text NOT NULL,
	`contested` integer DEFAULT false NOT NULL,
	`peer_earned_count` integer DEFAULT 0 NOT NULL,
	`peer_total_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`response_id`) REFERENCES `responses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`part_id`) REFERENCES `rubric_parts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `final_marks_response_part_idx` ON `final_marks` (`response_id`,`part_id`);--> statement-breakpoint
CREATE TABLE `peer_marks` (
	`id` text PRIMARY KEY NOT NULL,
	`review_assignment_id` text NOT NULL,
	`part_id` text NOT NULL,
	`earned` integer NOT NULL,
	`highlight_start` integer,
	`highlight_end` integer,
	`highlight_text` text DEFAULT '' NOT NULL,
	`criterion_code` text DEFAULT '' NOT NULL,
	`reason` text,
	`comment` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`review_assignment_id`) REFERENCES `review_assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`part_id`) REFERENCES `rubric_parts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `peer_marks_review_part_idx` ON `peer_marks` (`review_assignment_id`,`part_id`);--> statement-breakpoint
CREATE TABLE `responses` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`student_id` text NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`started_at` integer,
	`submitted_at` integer,
	`auto_submitted` integer DEFAULT false NOT NULL,
	`is_makeup` integer DEFAULT false NOT NULL,
	`released_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `responses_assignment_student_idx` ON `responses` (`assignment_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `responses_assignment_idx` ON `responses` (`assignment_id`);--> statement-breakpoint
CREATE TABLE `review_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`response_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`display_index` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`response_id`) REFERENCES `responses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_assignments_pair_idx` ON `review_assignments` (`response_id`,`reviewer_id`);--> statement-breakpoint
CREATE INDEX `review_assignments_reviewer_idx` ON `review_assignments` (`reviewer_id`);--> statement-breakpoint
CREATE TABLE `rubric_criteria` (
	`id` text PRIMARY KEY NOT NULL,
	`part_id` text NOT NULL,
	`code` text NOT NULL,
	`order_index` integer NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`part_id`) REFERENCES `rubric_parts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rubric_criteria_part_idx` ON `rubric_criteria` (`part_id`);--> statement-breakpoint
CREATE TABLE `rubric_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`label` text NOT NULL,
	`order_index` integer NOT NULL,
	`task_verb` text DEFAULT 'Explain' NOT NULL,
	`prompt_text` text NOT NULL,
	`grader_note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rubric_parts_assignment_idx` ON `rubric_parts` (`assignment_id`);--> statement-breakpoint
CREATE TABLE `sections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`term` text DEFAULT '' NOT NULL,
	`join_code` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sections_join_code_idx` ON `sections` (`join_code`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`student_id` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`section_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `students_section_idx` ON `students` (`section_id`);--> statement-breakpoint
CREATE TABLE `teacher_marks` (
	`id` text PRIMARY KEY NOT NULL,
	`response_id` text NOT NULL,
	`part_id` text NOT NULL,
	`earned` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`response_id`) REFERENCES `responses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`part_id`) REFERENCES `rubric_parts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teacher_marks_response_part_idx` ON `teacher_marks` (`response_id`,`part_id`);
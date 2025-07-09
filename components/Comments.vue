<template>
  <div class="comments-section">
    <h2 class="section-title">
      <message-outlined />
      留下你的想法
    </h2>
    <div class="comment-form">
      <a-avatar :size="40" class="form-avatar">
        <template #icon><user-outlined /></template>
      </a-avatar>
      <div class="form-content">
        <a-textarea
          v-model:value="newComment"
          placeholder="分享你的见解..."
          :rows="3"
          class="comment-textarea"
        />
        <a-button type="primary" @click="submitComment" class="submit-button">
          发布评论
        </a-button>
      </div>
    </div>

    <div class="comments-list">
      <div v-for="comment in comments" :key="comment.id" class="comment-item">
        <a-avatar :size="40" class="comment-avatar">
          <template #icon><user-outlined /></template>
        </a-avatar>
        <div class="comment-body">
          <div class="comment-header">
            <span class="comment-author">{{ comment.author }}</span>
            <span class="comment-date">{{ comment.date }}</span>
          </div>
          <p class="comment-text">{{ comment.text }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { UserOutlined, MessageOutlined } from '@ant-design/icons-vue';

const newComment = ref('');
const comments = ref([
  {
    id: 1,
    author: '探索者',
    date: '2小时前',
    text: '这个应用推荐页面太棒了！发现了很多宝藏工具，感谢分享。',
  },
  {
    id: 2,
    author: '设计爱好者',
    date: '1天前',
    text: '整体的毛玻璃质感非常统一，视觉效果很舒服。如果卡片能增加一些交互动效就更完美了。',
  },
  {
    id: 3,
    author: 'Nuxt新手',
    date: '3天前',
    text: '作为Nuxt初学者，这个项目给了我很多启发，特别是数据管理和组件化方面。',
  },
]);

const submitComment = () => {
  if (newComment.value.trim()) {
    comments.value.unshift({
      id: Date.now(),
      author: '访客',
      date: '刚刚',
      text: newComment.value,
    });
    newComment.value = '';
  }
};
</script>

<style scoped>
.comments-section {
  margin-top: 60px;
  padding: 30px;
  background: rgba(35, 35, 40, 0.5);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e8eaed;
}

html.light .comments-section {
    background: rgba(247, 248, 250, 0.8);
    border: 1px solid rgba(0, 0, 0, 0.08);
    color: #1f1f1f;
}

.section-title {
  font-size: 1.5rem;
  margin-bottom: 25px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: inherit;
}

.comment-form {
  display: flex;
  gap: 15px;
  margin-bottom: 40px;
}

.form-content {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.comment-textarea {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e8eaed;
  border-radius: 8px;
}

html.light .comment-textarea {
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(0, 0, 0, 0.1);
    color: #1f1f1f;
}

.comment-textarea:focus {
  border-color: #8ab4f8;
  box-shadow: 0 0 0 2px rgba(138, 180, 248, 0.2);
}

.submit-button {
  margin-top: 10px;
  border-radius: 6px;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.comment-item {
  display: flex;
  gap: 15px;
}

.comment-body {
  flex-grow: 1;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.comment-author {
  font-weight: 600;
  color: inherit;
}

.comment-date {
  font-size: 0.75rem;
  color: #bdc1c6;
}

html.light .comment-date {
    color: #5f6368;
}

.comment-text {
  margin: 0;
  line-height: 1.6;
  color: inherit;
  opacity: 0.9;
}
</style>

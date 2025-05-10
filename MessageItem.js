import { defineComponent } from 'vue';

export default defineComponent({
  name: 'MessageItem',
  props: {
    message: {
      type: Object,
      required: true
    },
    isTagged: {
      type: Boolean,
      default: false
    },
    isOwnMessage: {
      type: Boolean,
      default: false
    },
    editing: {
      type: Boolean,
      default: false
    },
    editContent: {
      type: String,
      default: ""
    },
    senderName: {
      type: String,
      default: ""
    },
    messageTags: {
      type: Array,
      default: () => []
    }
  },
  emits: ['tag', 'edit', 'delete', 'save-edit', 'cancel-edit', 'remove-tag'],
  data() {
    return {
      editText: "",
      showTagPopup: false
    };
  },
  watch: {
    editContent: {
      immediate: true,
      handler(newVal) {
        this.editText = newVal;
      }
    },
    editing(isEditing) {
      if (isEditing) {
        this.editText = this.message.value?.content || "";
      }
    }
  },
  computed: {
    bubbleContent() {
      return this.message.value?.content || this.message.content;
    },
    timestamp() {
      if (this.isTagged) {
        return new Date(this.message.value.published).toLocaleString();
      }
      return this.message.value?.published
        ? new Date(this.message.value.published).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
    },
    messageClass() {
      if (this.isTagged) return 'tagged';
      return this.isOwnMessage ? 'outgoing' : 'incoming';
    },
    wasEdited() {
      return this.message.value?.edited;
    },
    showSender() {
      return !this.isOwnMessage && !this.isTagged;
    },
    hasTags() {
      return this.messageTags && this.messageTags.length > 0;
    },
    groupedTags() {
      const groups = {};
      this.messageTags.forEach(tag => {
        if (!groups[tag]) {
          groups[tag] = 1;
        } else {
          groups[tag]++;
        }
      });
      return groups;
    }
  },
  methods: {
    handleSave() {
      if (this.editText && this.editText.trim()) {
        this.$emit('save-edit', this.editText.trim());
      } else {
        this.$emit('cancel-edit');
      }
    },
    handleCancel() {
      this.$emit('cancel-edit');
    },
    handleEscKey(e) {
      if (e.key === 'Escape') {
        this.handleCancel();
      } else if (e.key === 'Enter' && e.ctrlKey) {
        this.handleSave();
      }
    },
    removeTag(tag) {
      const messageId = this.message.url || this.message.id;
      this.$emit('remove-tag', tag, messageId);
      // Close popup if no tags left
      if (this.messageTags.length === 1) {
        this.showTagPopup = false;
      }
    },
    toggleTagPopup() {
      if (this.hasTags) {
        this.showTagPopup = !this.showTagPopup;
      }
    },
    closeTagPopup() {
      this.showTagPopup = false;
    }
  },
  template: `
    <div :class="['message', messageClass, {'editing': editing, 'has-tags': hasTags}]">
      <div v-if="showSender" class="sender-name">{{ senderName || 'Unknown user' }}</div>
      
      <div class="bubble">
        <template v-if="!editing">
          {{ bubbleContent }}
          <span v-if="wasEdited" class="edited-indicator">(edited)</span>
          <span v-if="hasTags" class="tag-indicator" @click="toggleTagPopup">🔖</span>
        </template>
        <div v-else class="edit-area">
          <textarea 
            v-model="editText" 
            @keydown="handleEscKey"
            placeholder="Edit your message..."
            ref="editTextarea"
            autofocus></textarea>
          <div class="edit-actions">
            <button class="save-btn" @click="handleSave">Save</button>
            <button class="cancel-btn" @click="handleCancel">Cancel</button>
          </div>
        </div>
      </div>
      
      <div class="timestamp">{{ timestamp }}</div>
      
      <div v-if="showTagPopup" class="tags-popup">
        <div class="tags-popup-header">
          Message Tags
          <button class="popup-close-btn" @click="closeTagPopup">×</button>
        </div>
        <div class="tags-list">
          <div v-for="(count, tag) in groupedTags" 
               :key="tag" 
               class="tag-item">
            <span class="tag-emoji">🔖</span>
            <span class="tag-name">{{ tag }}</span>
            <span v-if="count > 1" class="tag-count">{{ count }}</span>
            <button class="remove-tag" @click="removeTag(tag)" title="Remove tag">×</button>
          </div>
        </div>
      </div>
      
      <div class="message-actions" v-if="!isTagged">
        <button 
          class="tag-btn"
          @click="$emit('tag', message)"
          title="Tag this message">🔖</button>
        <template v-if="isOwnMessage">
          <button 
            class="edit-btn"
            @click="$emit('edit', message)"
            title="Edit message">✏️</button>
          <button 
            class="delete-btn"
            @click="$emit('delete', message)"
            title="Delete message">🗑️</button>
        </template>
      </div>
    </div>
  `
});

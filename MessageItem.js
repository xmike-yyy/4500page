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
    }
  },
  emits: ['tag'],
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
      return this.message.actor === this.$graffitiSession.value.actor ? 'outgoing' : 'incoming';
    }
  },
  template: `
    <div :class="['message', messageClass]">
      <div class="bubble">{{ bubbleContent }}</div>
      <div class="timestamp">{{ timestamp }}</div>
      <button
        v-if="!isTagged"
        class="tag-btn"
        @click="$emit('tag', message)"
        title="Tag this message"
      >🔖</button>
    </div>
  `
});

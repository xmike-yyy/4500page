export default {
    name: 'MessageBubble',
    
    props: {
      message: {
        type: Object,
        required: true
      },
      type: {
        type: String,
        default: 'incoming',
        validator: (value) => ['incoming', 'outgoing', 'tagged'].includes(value)
      },
      showTagButton: {
        type: Boolean,
        default: false
      },
      showTimestamp: {
        type: Boolean,
        default: true
      },
      additionalClass: {
        type: String,
        default: ''
      },
      conversationName: {
        type: String,
        default: ''
      }
    },
    
    emits: ['tag'],
    
    methods: {
      getMessageContent() {
        return this.message.value?.content || this.message.content;
      },
      
      formatTimestamp(timestamp) {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      },
      
      getFullTimestamp(timestamp) {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleString();
      },
      
      tagMessage() {
        this.$emit('tag', this.message);
      }
    },
    
    template: `
      <div :class="['message', type, additionalClass]">
        <div class="bubble">{{ getMessageContent() }}</div>
        <div v-if="showTimestamp" class="timestamp">
          {{ type === 'tagged' ? getFullTimestamp(message.value?.published) : formatTimestamp(message.value?.published) }}
        </div>
        <button v-if="showTagButton" class="tag-btn" @click="tagMessage" title="Tag this message">🔖</button>
      </div>
    `
  }
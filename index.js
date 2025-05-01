import { createApp } from "vue";
import { GraffitiLocal } from "@graffiti-garden/implementation-local";
import { GraffitiPlugin } from "@graffiti-garden/wrapper-vue";

createApp({
  data() {
    return {
      myMessage: "",
      sending: false,
      channels: [],
      currentGroupName: "",
      view: "inbox",
      conversations: [
        { id: "alice", name: "Alice" },
        { id: "bob",   name: "Bob" },
        { id: "carol", name: "Carol" }
      ],
      selectedTag: null,
      taggedMessages: [],
      processedMessages: new Map(),
      sessionTags: {},
      fakeMessages: {
        alice: [
          { id: 1, actor: "alice", content: "Hey there! It's Alice.", url: "fake-alice-1" },
          { id: 2, actor: "alice", content: "How are you today?", url: "fake-alice-2" }
        ],
        bob: [
          { id: 3, actor: "bob", content: "Bob here. Project update?", url: "fake-bob-1" },
          { id: 4, actor: "bob", content: "Don't forget the meeting.", url: "fake-bob-2" }
        ],
        carol: [
          { id: 5, actor: "carol", content: "Hello from Carol!", url: "fake-carol-1" },
          { id: 6, actor: "carol", content: "Let's catch up later.", url: "fake-carol-2" }
        ]
      }
    };
  },

  computed: {
    groupedTaggedMessages() {
      if (!this.taggedMessages.length) return {};
      
      const sorted = [...this.taggedMessages].sort((a, b) => 
        (b.value.published || 0) - (a.value.published || 0)
      );

      const groups = {};
      
      sorted.forEach(msg => {
        const conversationName = msg.value.conversationName || 'Unknown';
        
        if (!groups[conversationName]) {
          groups[conversationName] = [];
        }
        
        groups[conversationName].push(msg);
      });

      return groups;
    }
  },

  methods: {
    async sendMessage(session) {
      if (!this.myMessage.trim() || !this.channels.length) return;
      this.sending = true;
      try {
        await this.$graffiti.put(
          {
            value: { content: this.myMessage.trim(), published: Date.now() },
            channels: this.channels
          },
          session
        );
        this.myMessage = "";
        await this.$nextTick();
        this.$refs.messageInput?.focus();
      } finally {
        this.sending = false;
      }
    },

    selectConversation(id, name) {
      this.channels = [id];
      this.currentGroupName = name;
      this.view = "inbox";
      this.selectedTag = null;
      this.processedMessages.clear();
    },

    promptTag(msg) {
      const tag = prompt("Enter tag name for this message:");
      if (!tag || !tag.trim()) return;
      
      const messageContent = this.getMessageContent(msg);
      const messageId = msg.url || msg.id;
      const channelId = this.channels[0];
      const conversationName = this.conversations.find(c => c.id === channelId)?.name || 'Unknown';
      
      const tagData = { 
        activity: "Tag", 
        target: messageId,
        tag: tag.trim(),
        content: messageContent,
        conversationName,
        channelId,
        published: Date.now() 
      };
      
      if (!this.sessionTags[channelId]) {
        this.sessionTags[channelId] = [];
      }
      this.sessionTags[channelId].push({
        messageId,
        tag: tag.trim(),
        conversationName
      });

      try {
        const storedTags = JSON.parse(localStorage.getItem('designftw-tags') || '{}');
        if (!storedTags[channelId]) {
          storedTags[channelId] = [];
        }
        storedTags[channelId].push({
          messageId,
          tag: tag.trim(),
          conversationName
        });
        localStorage.setItem('designftw-tags', JSON.stringify(storedTags));
      } catch (e) {
        console.error("Failed to store tags in localStorage", e);
      }
      
      this.$graffiti.put(
        {
          value: tagData,
          channels: ["designftw"]
        },
        this.$graffitiSession.value
      );
    },

    selectTag(tagName, tagObjects) {
      this.selectedTag = tagName;
      
      const taggedWithSelectedTag = tagObjects.filter(obj => obj.value.tag === tagName);
      
      this.taggedMessages = taggedWithSelectedTag.map(tagObj => {
        let conversationName = this.lookupConversationName(tagObj.value.target);
        
        if (!conversationName) {
          conversationName = tagObj.value.conversationName || 'Unknown';
        }
        
        return {
          ...tagObj,
          value: {
            ...tagObj.value,
            content: tagObj.value.content || 'Message content not available',
            conversationName: conversationName
          }
        };
      });
    },
    
    lookupConversationName(target) {
      for (const [channelId, tags] of Object.entries(this.sessionTags)) {
        const match = tags.find(tag => tag.messageId === target);
        if (match) {
          return match.conversationName;
        }
      }
      
      try {
        const storedTags = JSON.parse(localStorage.getItem('designftw-tags') || '{}');
        for (const [channelId, tags] of Object.entries(storedTags)) {
          const match = tags.find(tag => tag.messageId === target);
          if (match) {
            return match.conversationName;
          }
        }
      } catch (e) {
        console.error("Failed to read tags from localStorage", e);
      }
      
      return this.getConversationNameFromTarget(target);
    },
    
    getConversationNameFromTarget(target) {
      for (const conv of this.conversations) {
        if (target.includes(conv.id)) {
          return conv.name;
        }
      }
      
      for (const [convId, messages] of Object.entries(this.fakeMessages)) {
        for (const msg of messages) {
          if (msg.url === target || msg.id.toString() === target) {
            return this.conversations.find(c => c.id === convId)?.name || 'Unknown';
          }
        }
      }
      
      return 'Unknown';
    },

    getAllMessages(channelId, graffitiMessages) {
      const fakeMsgs = this.fakeMessages[channelId] || [];
      const uniqueMessages = new Map();
      fakeMsgs.forEach(msg => {
        uniqueMessages.set(msg.url || msg.id, msg);
      });
      
      graffitiMessages.forEach(msg => {
        const msgId = msg.url || msg.id;
        if (!uniqueMessages.has(msgId)) {
          uniqueMessages.set(msgId, msg);
        }
      });
      
      return Array.from(uniqueMessages.values()).sort((a, b) => {
        const timeA = a.value?.published || 0;
        const timeB = b.value?.published || 0;
        return timeA - timeB;
      });
    },

    isOutgoingMessage(msg) {
      if (!this.$graffitiSession.value) return false;
      return msg.actor === this.$graffitiSession.value.actor;
    },

    getMessageContent(msg) {
      return msg.value?.content || msg.content;
    },
    
    formatTimestamp(timestamp) {
      if (!timestamp) return '';
      return new Date(timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    },
    
    loadStoredTags() {
      try {
        const storedTags = JSON.parse(localStorage.getItem('designftw-tags') || '{}');
        this.sessionTags = storedTags;
      } catch (e) {
        console.error("Failed to load tags from localStorage", e);
        this.sessionTags = {};
      }
    }
  },
  
  mounted() {
    this.loadStoredTags();
  }
})
.use(GraffitiPlugin, { graffiti: new GraffitiLocal() })
.mount("#app");
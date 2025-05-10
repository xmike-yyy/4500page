import { createApp } from "vue";
import { GraffitiRemote } from "@graffiti-garden/implementation-remote";
import { GraffitiLocal } from "@graffiti-garden/implementation-local";
import { GraffitiPlugin } from "@graffiti-garden/wrapper-vue";
import MessageItem from "./MessageItem.js";

const app = createApp({
  data() {
    return {
      profileName: "",
      profilePronouns: "",
      profileBio: "",
      showProfileEditor: false,
      editingProfile: {
        name: "",
        pronouns: "",
        bio: ""
      },

      myMessage: "",
      sending: false,
      channels: [],
      currentGroupName: "",
      view: "inbox",
      
      communities: [
        { id: "general", name: "General Chat", description: "Discussion about anything and everything" },
        { id: "tech", name: "Technology", description: "Tech discussions and news" },
        { id: "gaming", name: "Gaming", description: "Gaming discussions and meetups" },
        { id: "music", name: "Music", description: "Share your favorite tunes and artists" }
      ],
      
      editingMessageUrl: null,
      editMessageContent: "",

      selectedTag: null,
      taggedMessages: [],
      sessionTags: {},
      
      newCommunityName: "",
      newCommunityDescription: "",
      showCommunityForm: false,
      
      toast: {
        show: false,
        message: '',
        type: 'info',
        icon: '',
        timeout: null
      },
      
      _tagCache: {},
      _senderCache: {},
      _forceUiRefresh: false,
      _shouldForceScroll: false,
      _lastMessageCount: undefined
    };
  },

  components: { MessageItem },

  computed: {
    groupedTaggedMessages() {
      if (!this.taggedMessages.length) return {};
      const sorted = [...this.taggedMessages].sort(
        (a, b) => (b.value.published || 0) - (a.value.published || 0)
      );
      return sorted.reduce((groups, msg) => {
        const communityId = msg.value.channelId || "Unknown";
        const communityName = this.getCommunityName(communityId);
        (groups[communityName] = groups[communityName] || []).push(msg);
        return groups;
      }, {});
    }
  },

  methods: {
    getCommunityName(id) {
      const community = this.communities.find(c => c.id === id);
      return community ? community.name : "Unknown Community";
    },

    getPersonalTagChannel() {
      return "designftw-tags";
    },

    scrollToLatestMessages() {
      setTimeout(() => {
        const messagesContainer = document.querySelector('.message-list-container');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 50);
    },
    
    showToast(message, type = 'info', duration = 3000) {
      // Clear any existing timeout
      if (this.toast.timeout) {
        clearTimeout(this.toast.timeout);
      }
      
      // Set icon based on type
      let icon = '';
      switch (type) {
        case 'success':
          icon = '✅';
          break;
        case 'error':
          icon = '❌';
          break;
        case 'warning':
          icon = '⚠️';
          break;
        default:
          icon = 'ℹ️';
      }
      
      // Update toast data
      this.toast = {
        show: true,
        message,
        type,
        icon,
        timeout: setTimeout(() => {
          this.hideToast();
        }, duration)
      };
    },
    
    hideToast() {
      this.toast.show = false;
      if (this.toast.timeout) {
        clearTimeout(this.toast.timeout);
        this.toast.timeout = null;
      }
    },
    
    getMessageTags(messageId) {
      // Cache message tags for performance
      if (!this._tagCache) this._tagCache = {};
      if (this._tagCache[messageId]) return this._tagCache[messageId];
      
      const allTags = Object.values(this.sessionTags).flat();
      const tags = allTags
        .filter(t => t.messageId === messageId)
        .map(t => t.tag);
      
      this._tagCache[messageId] = tags;
      return tags;
    },
    
    loadStoredTags() {
      try {
        this.sessionTags = JSON.parse(localStorage.getItem("designftw-tags") || "{}");
      } catch {
        this.sessionTags = {};
      }
    },

    async loadProfile() {
      const session = this.$graffitiSession.value;
      if (!session) return;
      const actor = await session.actor;

      const schema = {
        type: "object",
        properties: {
          value: {
            type: "object",
            required: ["name", "describes", "published"],
            properties: {
              name:      { type: "string" },
              pronouns:  { type: "string" },
              bio:       { type: "string" },
              describes: { const: actor },
              published: { type: "number" }
            }
          }
        }
      };

      const objs = [];
      for await (const { object } of this.$graffiti.discover([actor], schema, session)) {
        objs.push(object);
      }
      if (objs.length) {
        const latest = objs.sort((a, b) =>
          (b.value.published || 0) - (a.value.published || 0)
        )[0];
        this.profileName = latest.value.name;
        this.profilePronouns = latest.value.pronouns || "";
        this.profileBio = latest.value.bio || "";
      }
      return objs.length > 0;
    },

    async saveProfile(name, pronouns, bio) {
      if (!name?.trim()) return;

      const session = this.$graffitiSession.value;
      if (!session) return;
      const actor = await session.actor;

      const schema = {
        type: "object",
        properties: {
          value: {
            type: "object",
            required: ["name", "describes", "published"],
            properties: {
              describes: { const: actor }
            }
          }
        }
      };

      let existingProfile = null;
      for await (const { object } of this.$graffiti.discover([actor], schema, session)) {
        if (!existingProfile || object.value.published > existingProfile.value.published) {
          existingProfile = object;
        }
      }

      if (existingProfile) {
        await this.$graffiti.put(
          {
            ...existingProfile,
            value: {
              ...existingProfile.value,
              name: name.trim(),
              pronouns: pronouns || "",
              bio: bio || "",
              published: Date.now()
            }
          },
          session
        );
      } else {
        await this.$graffiti.put(
          {
            value: {
              name: name.trim(),
              pronouns: pronouns || "",
              bio: bio || "",
              generator: "https://xmike-yyy.github.io/4500page/",
              describes: actor,
              published: Date.now()
            },
            channels: [actor, "designftw-2025-studio2"]
          },
          session
        );
      }
      
      this.profileName = name.trim();
      this.profilePronouns = pronouns || "";
      this.profileBio = bio || "";
    },

    promptProfileName() {
      const newName = prompt("What's your name?", this.profileName);
      const newPronouns = prompt("Your pronouns (optional):", this.profilePronouns);
      const newBio = prompt("Short bio (optional):", this.profileBio);
      
      if (newName?.trim()) {
        this.saveProfile(newName, newPronouns, newBio);
      }
    },
    
    async ensureProfile(session) {
      if (!session) return;
      const hasProfile = await this.loadProfile();
      
      if (!hasProfile) {
        const actor = await session.actor;
        const defaultName = actor.split('/').pop() || 'user' + Math.floor(Math.random()*10000);
        
        this.editingProfile.name = defaultName;
        this.editingProfile.pronouns = "";
        this.editingProfile.bio = "";
        this.showProfileEditor = true;
        
        this.profileName = defaultName;
      }
    },

    getAllMessages(_channelId, graffitiMessages) {
      const messages = [...graffitiMessages].sort((a, b) => (a.value.published || 0) - (b.value.published || 0));
      
      if (this._lastMessageCount === undefined || 
          this._lastMessageCount < messages.length || 
          this._shouldForceScroll ||
          this._forceUiRefresh) {
        this.scrollToLatestMessages();
        this._shouldForceScroll = false;
        this._forceUiRefresh = false;
      }
      
      this._lastMessageCount = messages.length;
      return messages;
    },

    async sendMessage(session) {
      if (!this.myMessage.trim() || !this.channels.length) return;
      this.sending = true;
      try {
        console.log("Current actor ID:", session.actor);
        await this.$graffiti.put(
          {
            value: { 
              content: this.myMessage.trim(), 
              published: Date.now(),
              edited: false,
              actor: session.actor
            },
            channels: this.channels
          },
          session
        );
        this.myMessage = "";
        this._shouldForceScroll = true;
        await this.$nextTick();
        this.$refs.messageInput?.focus();
      } finally {
        this.sending = false;
      }
    },

    selectCommunity(id, name) {
      this.channels = [id];
      this.currentGroupName = name;
      this.view = "inbox";
      this.selectedTag = null;
      this._lastMessageCount = undefined;
      this._shouldForceScroll = true;
      this._tagCache = {};
      this._senderCache = {};
    },

    startEditMessage(msg) {
      this.editingMessageUrl = msg.url || msg.id;
      this.editMessageContent = msg.value?.content || '';
    },

    cancelEdit() {
      this.editingMessageUrl = null;
      this.editMessageContent = '';
    },

    async saveEditMessage(session, msg, newContent) {
      const content = newContent || this.editMessageContent;
      
      if (!content || !content.trim()) {
        this.cancelEdit();
        return;
      }
      
      try {
        const updatedMsg = {
          ...msg,
          value: {
            ...msg.value,
            content: content.trim(),
            edited: true,
          }
        };
        
        await this.$graffiti.put(updatedMsg, session);
      } catch (error) {
        console.error("Failed to save edited message:", error);
      } finally {
        this.cancelEdit();
      }
    },

    async deleteMessage(session, url) {
      if (confirm("Are you sure you want to delete this message?")) {
        await this.$graffiti.delete(url, session);
      }
    },

    promptTag(msg) {
      const tag = prompt("Enter tag name for this message:");
      if (!tag?.trim()) return;
      
      const messageContent = this.getMessageContent(msg);
      const messageId = msg.url || msg.id;
      console.log("Tagging message ID:", messageId);
      
      const channelId = this.channels[0];
      const communityName = this.getCommunityName(channelId);
      const actor = msg.actor || msg.value?.actor;

      // Store in session tags
      if (!this.sessionTags[channelId]) this.sessionTags[channelId] = [];
      this.sessionTags[channelId].push({
        messageId,
        tag: tag.trim(),
        communityName,
        content: messageContent,
        actor,
        channelId
      });
      
      try {
        const stored = JSON.parse(localStorage.getItem("designftw-tags") || "{}");
        (stored[channelId] = stored[channelId] || []).push({
          messageId,
          tag: tag.trim(),
          communityName,
          content: messageContent,
          actor,
          channelId
        });
        localStorage.setItem("designftw-tags", JSON.stringify(stored));
        
        // Clear tag cache for this message
        if (this._tagCache) {
          this._tagCache[messageId] = null;
        }
        
        this.showToast(`Tag "${tag.trim()}" added successfully!`, 'success');
        
        // Force UI refresh
        this._forceUiRefresh = true;
        setTimeout(() => {
          this._forceUiRefresh = false;
        }, 100);
      } catch (e) {
        console.error("Failed to store tags", e);
        this.showToast("Failed to add tag", 'error');
      }
    },

    selectTag(tagName) {
      this.selectedTag = tagName;
      const tagged = Object.values(this.sessionTags).flat().filter(t => t.tag === tagName);
      this.taggedMessages = tagged.map(t => ({
        value: {
          content: t.content || "Message content not available",
          communityName: t.communityName,
          published: Date.now(),
          actor: t.actor || this.$graffitiSession.value?.actor,
          channelId: t.channelId
        }
      }));
      
      this.$nextTick(() => {
        const container = document.querySelector('.message-list-container');
        if (container) container.scrollTop = 0;
      });
    },

    lookupCommunityName(target) {
      for (const [cid, tags] of Object.entries(this.sessionTags)) {
        const match = tags.find(t => t.messageId === target);
        if (match) return match.communityName;
      }
      try {
        const stored = JSON.parse(localStorage.getItem("designftw-tags") || "{}");
        for (const tags of Object.values(stored)) {
          const match = tags.find(t => t.messageId === target);
          if (match) return match.communityName;
        }
      } catch {}
      return this.getCommunityNameFromTarget(target);
    },

    getCommunityNameFromTarget(target) {
      for (const community of this.communities) {
        if (target.includes(community.id)) {
          return community.name;
        }
      }
      return "Unknown Community";
    },

    getSenderName(actorId) {
      if (this.$graffitiSession.value && actorId === this.$graffitiSession.value.actor) {
        return "You";
      }
      
      const parts = actorId.split('/');
      const lastPart = parts[parts.length - 1];
      
      return lastPart.length > 10 
        ? lastPart.slice(0, 10) + '...' 
        : lastPart;
    },

    getMessageContent(msg) {
      return msg.value?.content || msg.content;
    },

    showProfileForm() {
      this.editingProfile.name = this.profileName;
      this.editingProfile.pronouns = this.profilePronouns;
      this.editingProfile.bio = this.profileBio;
      this.showProfileEditor = true;
    },

    cancelProfileEdit() {
      this.showProfileEditor = false;
    },

    async saveProfileFromForm() {
      if (!this.editingProfile.name?.trim()) return;
      
      await this.saveProfile(
        this.editingProfile.name,
        this.editingProfile.pronouns,
        this.editingProfile.bio
      );
      
      this.showProfileEditor = false;
    },

    createCommunity() {
      if (!this.newCommunityName.trim()) return;
      
      const id = this.newCommunityName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36);
      
      this.communities.push({
        id,
        name: this.newCommunityName.trim(),
        description: this.newCommunityDescription.trim() || "A new community"
      });
      
      this.newCommunityName = "";
      this.newCommunityDescription = "";
      this.showCommunityForm = false;
      
      this.selectCommunity(id, this.communities[this.communities.length - 1].name);
      
      try {
        localStorage.setItem("designftw-communities", JSON.stringify(this.communities));
      } catch (e) {
        console.error("Failed to store communities", e);
      }
    },
    
    showCommunityCreationForm() {
      this.showCommunityForm = true;
    },
    
    cancelCommunityCreation() {
      this.showCommunityForm = false;
      this.newCommunityName = "";
      this.newCommunityDescription = "";
    },

    removeTag(tag, messageId) {
      try {
        const stored = JSON.parse(localStorage.getItem("designftw-tags") || "{}");
        for (const channelId in stored) {
          stored[channelId] = stored[channelId].filter(t => 
            !(t.messageId === messageId && t.tag === tag)
          );
        }
        localStorage.setItem("designftw-tags", JSON.stringify(stored));
        
        // Update in-memory tags and reset only the specific cache entry
        this.sessionTags = stored;
        if (this._tagCache && this._tagCache[messageId]) {
          this._tagCache[messageId] = null;
        }
        
        this.showToast(`Tag "${tag}" removed successfully!`, 'success');
        
        // Force UI refresh
        this._forceUiRefresh = true;
        setTimeout(() => {
          this._forceUiRefresh = false;
        }, 100);
      } catch (e) {
        console.error("Failed to remove tag", e);
        this.showToast("Failed to remove tag", 'error');
      }
    }
  },

  mounted() {
    this.loadStoredTags();
    
    try {
      const savedCommunities = localStorage.getItem("designftw-communities");
      if (savedCommunities) {
        this.communities = JSON.parse(savedCommunities);
      }
    } catch (e) {
      console.error("Failed to load communities", e);
    }
    
    if (this.communities.length) {
      this.selectCommunity(this.communities[0].id, this.communities[0].name);
    }
    
    this.$watch(
      () => this.$graffitiSession.value,
      async (newSession) => {
        if (newSession) {
          await this.ensureProfile(newSession);
        }
      },
      { immediate: true }
    );
  }
});

app
  .use(GraffitiPlugin, { graffiti: new GraffitiLocal() })
  .mount("#app");

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
        { id: "general", name: "General Chat", description: "Discussion about anything and everything", createdBy: "system" },
        { id: "tech", name: "Technology", description: "Tech discussions and news", createdBy: "system" },
        { id: "gaming", name: "Gaming", description: "Gaming discussions and meetups", createdBy: "system" },
        { id: "music", name: "Music", description: "Share your favorite tunes and artists", createdBy: "system" }
      ],
      
      joinedCommunities: ["general"],
      
      editingMessageUrl: null,
      editMessageContent: "",

      selectedTag: null,
      taggedMessages: [],
      sessionTags: {},
      
      newCommunityName: "",
      newCommunityDescription: "",
      showCommunityForm: false,
      
      availableCommunitiesExpanded: false,
      
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
      if (!this || typeof this.toast === 'undefined') {
        console.warn('Toast notification system not initialized yet');
        return;
      }
      
      if (this.toast && this.toast.timeout) {
        clearTimeout(this.toast.timeout);
      }
      
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
      if (!this || typeof this.toast === 'undefined') {
        return;
      }
      
      this.toast.show = false;
      if (this.toast.timeout) {
        clearTimeout(this.toast.timeout);
        this.toast.timeout = null;
      }
    },
    
    getMessageTags(messageId) {
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
      if (!this.joinedCommunities.includes(id)) {
        this.joinCommunity(id);
      }
      
      this.channels = [id];
      this.currentGroupName = name;
      this._shouldForceScroll = true;
      this.view = "inbox";
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
        
        if (this._tagCache) {
          this._tagCache[messageId] = null;
        }
        
        this.showToast?.(`Tag "${tag.trim()}" added successfully!`, 'success');
        
        this._forceUiRefresh = true;
        setTimeout(() => {
          this._forceUiRefresh = false;
        }, 100);
      } catch (e) {
        console.error("Failed to store tags", e);
        this.showToast?.("Failed to add tag", 'error');
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

    async createCommunity() {
      if (!this.newCommunityName.trim()) return;
      
      const id = this.newCommunityName.toLowerCase().replace(/\s+/g, '-');
      
      if (this.communities.some(c => c.id === id)) {
        this.showToast?.('A community with a similar name already exists', 'error');
        return;
      }
      
      const session = this.$graffitiSession.value;
      if (!session) return;
      
      const actor = await session.actor;
      
      const newCommunity = {
        id: id,
        name: this.newCommunityName.trim(),
        description: this.newCommunityDescription.trim() || `Chat about ${this.newCommunityName.trim()}`,
        createdBy: actor
      };
      
      this.communities.push(newCommunity);
      this.joinCommunity(id);
      this.selectCommunity(id, newCommunity.name);
      
      this.newCommunityName = "";
      this.newCommunityDescription = "";
      this.showCommunityForm = false;
      
      this.saveCommunities();
      this.showToast?.(`Created and joined ${newCommunity.name}!`, 'success');
    },
    
    async deleteCommunity(communityId) {
      const communityIndex = this.communities.findIndex(c => c.id === communityId);
      if (communityIndex === -1) return;
      
      const community = this.communities[communityIndex];
      
      const session = this.$graffitiSession.value;
      if (!session) return;
      
      const actor = await session.actor;
      if (community.createdBy !== actor) {
        this.showToast?.("You can only delete communities you created", 'error');
        return;
      }
      
      if (communityId === 'general') {
        this.showToast?.("The General Chat cannot be deleted", 'warning');
        return;
      }
      
      if (confirm(`Are you sure you want to delete the community "${community.name}"?`)) {
        if (this.channels[0] === communityId) {
          this.selectCommunity('general', 'General Chat');
        }
        
        const joinedIndex = this.joinedCommunities.indexOf(communityId);
        if (joinedIndex > -1) {
          this.joinedCommunities.splice(joinedIndex, 1);
          this.saveJoinedCommunities();
        }
        
        this.communities.splice(communityIndex, 1);
        this.saveCommunities();
        
        this.showToast?.(`Community "${community.name}" has been deleted`, 'success');
      }
    },
    
    saveCommunities() {
      try {
        const communitiesToSave = this.communities.filter(c => c.createdBy !== "system");
        localStorage.setItem("designftw-communities", JSON.stringify(communitiesToSave));
      } catch (e) {
        console.error("Failed to save communities", e);
      }
    },
    
    loadCommunities() {
      try {
        const saved = localStorage.getItem("designftw-communities");
        if (saved) {
          const userCommunities = JSON.parse(saved);
          for (const community of userCommunities) {
            if (!this.communities.some(c => c.id === community.id)) {
              this.communities.push(community);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load communities", e);
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
        this.sessionTags = stored;
        if (this._tagCache && this._tagCache[messageId]) {
          this._tagCache[messageId] = null;
        }
        
        this.showToast?.(`Tag "${tag}" removed successfully!`, 'success');
        this._forceUiRefresh = true;
        setTimeout(() => {
          this._forceUiRefresh = false;
        }, 100);
      } catch (e) {
        console.error("Failed to remove tag", e);
        this.showToast?.("Failed to remove tag", 'error');
      }
    },

    joinCommunity(communityId) {
      if (!this.joinedCommunities.includes(communityId)) {
        this.joinedCommunities.push(communityId);
        this.saveJoinedCommunities();
        this.showToast?.(`You've joined ${this.getCommunityName(communityId)}`, 'success');
        if (this.joinedCommunities.length === 1) {
          this.selectCommunity(communityId, this.getCommunityName(communityId));
        }
      }
    },

    leaveCommunity(communityId) {
      if (communityId === 'general') {
        this.showToast?.("You cannot leave General Chat", 'warning');
        return;
      }
      
      const index = this.joinedCommunities.indexOf(communityId);
      if (index > -1) {
        this.joinedCommunities.splice(index, 1);
        this.saveJoinedCommunities();
        this.showToast?.(`You've left ${this.getCommunityName(communityId)}`, 'info');
        
        if (this.channels[0] === communityId) {
          this.selectCommunity('general', 'General Chat');
        }
      }
    },
    
    saveJoinedCommunities() {
      try {
        localStorage.setItem("designftw-joined-communities", JSON.stringify(this.joinedCommunities));
      } catch (e) {
        console.error("Failed to save joined communities", e);
      }
    },
    
    loadJoinedCommunities() {
      try {
        const saved = localStorage.getItem("designftw-joined-communities");
        if (saved) {
          this.joinedCommunities = JSON.parse(saved);
          if (!this.joinedCommunities.includes('general')) {
            this.joinedCommunities.push('general');
            this.saveJoinedCommunities();
          }
        }
      } catch (e) {
        console.error("Failed to load joined communities", e);
        this.joinedCommunities = ['general'];
      }
    },

    toggleAvailableCommunities() {
      this.availableCommunitiesExpanded = !this.availableCommunitiesExpanded;
    }
  },

  mounted() {
    if (typeof this.toast === 'undefined') {
      this.toast = {
        show: false,
        message: '',
        type: 'info',
        icon: '',
        timeout: null
      };
    }
    
    this.loadStoredTags();
    this.loadCommunities();
    this.loadJoinedCommunities();
    
    if (this.$graffitiSession.value) {
      this.ensureProfile(this.$graffitiSession.value).catch(err => {
        console.error("Error loading profile:", err);
      });
    }
    
    this.$watch(
      '$graffitiSession',
      async (newValue) => {
        if (newValue) {
          try {
            const hasProfile = await this.loadProfile();
            if (!hasProfile) {
              this.showProfileForm();
            }
          } catch (error) {
            console.error("Error in graffitiSession watcher:", error);
          }
        }
      }
    );
    
    if (!this.channels.length && this.communities.length) {
      this.selectCommunity(this.communities[0].id, this.communities[0].name);
    }
    
    if (!this.joinedCommunities.includes('general')) {
      this.joinedCommunities.push('general');
      this.saveJoinedCommunities();
    }
    
    this.$watch(
      () => this.$route?.query?.channel,
      (newChannel) => {
        if (newChannel) {
          const community = this.communities.find(c => c.id === newChannel);
          if (community) {
            this.selectCommunity(community.id, community.name);
          }
        }
      }
    );
  }
});

app
  .use(GraffitiPlugin, { graffiti: new GraffitiRemote() })
  .mount("#app");

window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled Promise Rejection:', event.reason);
  if (app && app._instance && app._instance.exposed) {
    const vm = app._instance.exposed;
    if (vm.showToast) {
      vm.showToast('An error occurred. Please try again.', 'error');
    }
  }
});

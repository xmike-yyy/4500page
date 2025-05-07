import { createApp } from "vue";
import { GraffitiRemote } from "@graffiti-garden/implementation-remote";
import { GraffitiPlugin } from "@graffiti-garden/wrapper-vue";
import MessageItem from "./MessageItem.js";

const app = createApp({
  data() {
    return {
      // Profile
      profileName: "",

      // Chat state
      myMessage: "",
      sending: false,
      channels: [],
      currentGroupName: "",
      view: "inbox",
      conversations: [
        { id: "alice", name: "Alice" },
        { id: "bob",   name: "Bob"   },
        { id: "carol", name: "Carol" }
      ],

      // Tagging state
      selectedTag: null,
      taggedMessages: [],
      sessionTags: {}
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
        const name = msg.value.conversationName || "Unknown";
        ;(groups[name] = groups[name] || []).push(msg);
        return groups;
      }, {});
    }
  },

  methods: {
    // ——— Profile load/save ———
    async loadProfile() {
      const session = this.$graffitiSession.value;
      if (!session) return;
      const actor = await session.actor;

      const schema = {
        type: "object",
        properties: {
          value: {
            type: "object",
            required: ["name", "generator", "describes", "published"],
            properties: {
              name:      { type: "string" },
              generator: { type: "string", format: "uri" },
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
        const latest = objs.sort((a, b) => (b.value.published || 0) - (a.value.published || 0))[0];
        this.profileName = latest.value.name;
      }
    },

    async saveProfile(name) {
      if (!name) return;
      const session = this.$graffitiSession.value;
      if (!session) return;
      const actor = await session.actor;

      await this.$graffiti.put(
        {
          value: {
            name,
            generator: "https://xmike-yyy.github.io/4500page/",
            describes: actor,
            published: Date.now()
          },
          channels: [actor, "designftw-2025-studio2"]
        },
        session
      );
      this.profileName = name;
    },

    // ——— Messaging & tagging ———
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
    },

    promptTag(msg) {
      const tag = prompt("Enter tag name for this message:");
      if (!tag?.trim()) return;
      const messageContent = this.getMessageContent(msg);
      const messageId = msg.url || msg.id;
      const channelId = this.channels[0];
      const conversationName = this.conversations.find(c => c.id === channelId)?.name || "Unknown";

      // store locally
      if (!this.sessionTags[channelId]) this.sessionTags[channelId] = [];
      this.sessionTags[channelId].push({ messageId, tag: tag.trim(), conversationName });
      try {
        const stored = JSON.parse(localStorage.getItem("designftw-tags") || "{}");
        (stored[channelId] = stored[channelId] || []).push({ messageId, tag: tag.trim(), conversationName });
        localStorage.setItem("designftw-tags", JSON.stringify(stored));
      } catch (e) {
        console.error("Failed to store tags", e);
      }

      // remote tag object
      this.$graffiti.put(
        {
          value: {
            activity: "Tag",
            target: messageId,
            tag: tag.trim(),
            content: messageContent,
            conversationName,
            channelId,
            published: Date.now()
          },
          channels: ["designftw"]
        },
        this.$graffitiSession.value
      );
    },

    selectTag(tagName, tagObjects) {
      this.selectedTag = tagName;
      const tagged = tagObjects.filter(o => o.value.tag === tagName);
      this.taggedMessages = tagged.map(o => ({
        ...o,
        value: {
          ...o.value,
          content: o.value.content || "Message content not available",
          conversationName:
            this.lookupConversationName(o.value.target) || o.value.conversationName || "Unknown"
        }
      }));
    },

    lookupConversationName(target) {
      for (const [cid, tags] of Object.entries(this.sessionTags)) {
        const match = tags.find(t => t.messageId === target);
        if (match) return match.conversationName;
      }
      try {
        const stored = JSON.parse(localStorage.getItem("designftw-tags") || "{}");
        for (const tags of Object.values(stored)) {
          const match = tags.find(t => t.messageId === target);
          if (match) return match.conversationName;
        }
      } catch {}
      return this.getConversationNameFromTarget(target);
    },

    getConversationNameFromTarget(target) {
      const conv = this.conversations.find(c => target.includes(c.id));
      if (conv) return conv.name;
      return "Unknown";
    },

    // ——— Return only real messages ———
    getAllMessages(_channelId, graffitiMessages) {
      // Sort by timestamp; no fake fallback at all
      return graffitiMessages
        .slice()
        .sort((a, b) => (a.value.published || 0) - (b.value.published || 0));
    },

    getMessageContent(msg) {
      return msg.value?.content || msg.content;
    },

    loadStoredTags() {
      try {
        this.sessionTags = JSON.parse(localStorage.getItem("designftw-tags") || "{}");
      } catch {
        this.sessionTags = {};
      }
    }
  },

  mounted() {
    this.loadStoredTags();
    this.loadProfile();
  }
});

app
  .use(GraffitiPlugin, { graffiti: new GraffitiRemote() })
  .mount("#app");

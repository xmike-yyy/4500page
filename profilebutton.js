export default {
    name: 'ProfileButton',
    
    props: {
      actor: {
        type: String,
        required: true
      },
      session: {
        type: Object,
        required: true
      },
      showName: {
        type: Boolean,
        default: true
      },
      size: {
        type: String,
        default: 'medium',
        validator: (value) => ['small', 'medium', 'large'].includes(value)
      }
    },
    
    data() {
      return {
        profile: null,
        isLoading: false,
        error: null
      };
    },
    
    computed: {
      displayName() {
        return this.profile?.name || this.shortenActorUri(this.actor);
      },
      
      firstInitial() {
        return (this.profile?.name || this.shortenActorUri(this.actor)).charAt(0);
      },
      
      picClass() {
        return {
          'profile-button-pic': true,
          'size-small': this.size === 'small',
          'size-medium': this.size === 'medium',
          'size-large': this.size === 'large'
        };
      }
    },
    
    methods: {
      shortenActorUri(uri) {
        if (!uri) return 'User';
        const parts = uri.split('/');
        return parts[parts.length - 1] || uri;
      },
      
      async fetchProfile() {
        this.isLoading = true;
        this.error = null;
        
        try {
            const [latest] = await this.$graffiti.discover(
              {
                channels: [ this.actor ],
                schema: {
                  properties: {
                    value: {
                      required: ['name','describes','published'],
                      properties: {
                        name:      { type: 'string' },
                        describes: { type: 'string', const: this.actor },
                        published: { type: 'number' }
                      }
                    }
                  }
                },
                sort:  [{ term: 'published', order: 'desc' }],
                limit: 1
              },
              this.session
            );

            if (latest) {
              this.profile = latest.value;
            }
        } catch (error) {
          console.error('Error fetching profile:', error);
          this.error = 'Failed to load profile';
        } finally {
          this.isLoading = false;
        }
      },
      
      openProfile() {
        this.$emit('open-profile', this.actor);
      }
    },
    
    created() {
      this.fetchProfile();
    },
    
    template: `
      <button class="profile-button" @click="openProfile">
        <div 
          :class="picClass"
          :style="profile?.icon ? \`background-image: url(\${profile.icon})\` : ''"
        >
          <span v-if="!profile?.icon">{{ firstInitial }}</span>
        </div>
        <span v-if="showName" class="profile-button-name">{{ displayName }}</span>
      </button>
    `
  }
export default {
    name: 'ProfileComponent',
    
    props: {
      session: {
        type: Object,
        required: true
      },
      isCurrentUser: {
        type: Boolean,
        default: false
      }
    },
  
    data() {
      return {
        profile: null,
        isEditing: false,
        formData: {
          name: '',
          pronouns: '',
          bio: '',
          iconUrl: ''
        },
        fileInput: null,
        isLoading: false,
        error: null
      };
    },
    
    computed: {
      actorUri() {
        return this.session?.actor || '';
      },
      
      displayName() {
        return this.profile?.name || this.shortenActorUri(this.actorUri);
      },
      
      hasProfile() {
        return !!this.profile;
      }
    },
    
    methods: {
      shortenActorUri(uri) {
        if (!uri) return 'Unknown User';
        const parts = uri.split('/');
        return parts[parts.length - 1] || uri;
      },
      
      async fetchProfile() {
        this.isLoading = true;
        this.error = null;
        
        try {
          const profiles = await this.$graffiti.query({
            schema: {
              properties: {
                value: {
                  required: ['describes'],
                  properties: {
                    describes: { 
                      type: 'string',
                      const: this.actorUri
                    }
                  }
                }
              }
            },
            channels: [this.actorUri]
          }, this.session);
          
          const sortedProfiles = profiles.sort((a, b) => 
            (b.value.published || 0) - (a.value.published || 0)
          );
          
          if (sortedProfiles.length > 0) {
            this.profile = sortedProfiles[0].value;
            this.formData = {
              name: this.profile.name || '',
              pronouns: this.profile.pronouns || '',
              bio: this.profile.bio || '',
              iconUrl: this.profile.icon || ''
            };
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          this.error = 'Failed to load profile';
        } finally {
          this.isLoading = false;
        }
      },
      
      startEditing() {
        if (!this.isCurrentUser) return;
        
        this.isEditing = true;
        
        if (this.profile) {
          this.formData = {
            name: this.profile.name || '',
            pronouns: this.profile.pronouns || '',
            bio: this.profile.bio || '',
            iconUrl: this.profile.icon || ''
          };
        }
      },
      
      cancelEditing() {
        this.isEditing = false;
        if (this.profile) {
          this.formData = {
            name: this.profile.name || '',
            pronouns: this.profile.pronouns || '',
            bio: this.profile.bio || '',
            iconUrl: this.profile.icon || ''
          };
        }
      },
      
      async saveProfile() {
        if (!this.isCurrentUser) return;
        
        this.isLoading = true;
        this.error = null;
        
        try {
          const profileData = {
            name: this.formData.name.trim() || this.shortenActorUri(this.actorUri),
            pronouns: this.formData.pronouns.trim(),
            bio: this.formData.bio.trim(),
            describes: this.actorUri,
            published: Date.now()
          };
          
          if (this.formData.iconUrl.trim()) {
            profileData.icon = this.formData.iconUrl.trim();
          }
          
          await this.$graffiti.put(
            {
              value: profileData,
              channels: [this.actorUri]
            },
            this.session
          );
          
          this.profile = profileData;
          this.isEditing = false;
        } catch (error) {
          console.error('Error saving profile:', error);
          this.error = 'Failed to save profile';
        } finally {
          this.isLoading = false;
        }
      },
      
      setupFileInput() {
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = 'image/*';
        this.fileInput.style.display = 'none';
        document.body.appendChild(this.fileInput);
        
        this.fileInput.addEventListener('change', this.handleFileSelected);
      },
      
      promptFileSelection() {
        if (this.fileInput) {
          this.fileInput.click();
        }
      },
      
      async handleFileSelected(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
          const imageUrl = prompt('Please enter an image URL for your profile picture:', '');
          if (imageUrl && imageUrl.trim()) {
            this.formData.iconUrl = imageUrl.trim();
          }
        } catch (error) {
          console.error('Error handling file:', error);
          this.error = 'Failed to process file';
        }
      },
      
      createDefaultProfile() {
        if (!this.isCurrentUser) return;
        
        this.startEditing();
      }
    },
    
    created() {
      this.fetchProfile();
    },
    
    mounted() {
      this.setupFileInput();
    },
    
    beforeUnmount() {
      if (this.fileInput) {
        this.fileInput.removeEventListener('change', this.handleFileSelected);
        document.body.removeChild(this.fileInput);
      }
    },
  
    template: `
      <div class="profile-container">
        <div v-if="isLoading" class="loading">Loading profile...</div>
        
        <div v-else-if="error" class="error">{{ error }}</div>
        
        <div v-else-if="!hasProfile && isCurrentUser" class="no-profile">
          <p>You don't have a profile yet.</p>
          <button @click="createDefaultProfile" class="primary-btn">Create Profile</button>
        </div>
        
        <div v-else-if="!hasProfile" class="no-profile">
          <p>This user doesn't have a profile yet.</p>
        </div>
        
        <div v-else-if="!isEditing" class="profile-view">
          <div class="profile-header">
            <div class="profile-pic" :style="profile.icon ? \`background-image: url(\${profile.icon})\` : ''">
              <span v-if="!profile.icon">{{ displayName.charAt(0) }}</span>
            </div>
            <div class="profile-info">
              <h2 class="profile-name">{{ displayName }}</h2>
              <p v-if="profile.pronouns" class="profile-pronouns">{{ profile.pronouns }}</p>
            </div>
            <button v-if="isCurrentUser" @click="startEditing" class="edit-btn">Edit</button>
          </div>
          
          <div v-if="profile.bio" class="profile-bio">
            <p>{{ profile.bio }}</p>
          </div>
        </div>
        
        <div v-else class="profile-edit">
          <h2>Edit Profile</h2>
          
          <div class="form-group">
            <label for="profile-name">Display Name</label>
            <input 
              id="profile-name" 
              v-model="formData.name" 
              placeholder="Your display name"
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label for="profile-pronouns">Pronouns</label>
            <input 
              id="profile-pronouns" 
              v-model="formData.pronouns" 
              placeholder="Your pronouns (e.g., they/them)"
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label for="profile-bio">Bio</label>
            <textarea 
              id="profile-bio" 
              v-model="formData.bio" 
              placeholder="Tell us about yourself"
              class="form-textarea"
            ></textarea>
          </div>
          
          <div class="form-group">
            <label>Profile Picture</label>
            <div class="profile-pic-preview" :style="formData.iconUrl ? \`background-image: url(\${formData.iconUrl})\` : ''">
              <span v-if="!formData.iconUrl">{{ formData.name.charAt(0) || actorUri.charAt(0) }}</span>
            </div>
            <div class="profile-pic-actions">
              <button @click="promptFileSelection" class="secondary-btn">Change Picture</button>
              <input 
                v-model="formData.iconUrl" 
                placeholder="Or enter image URL"
                class="form-input icon-url-input"
              />
            </div>
          </div>
          
          <div class="form-actions">
            <button @click="cancelEditing" class="cancel-btn">Cancel</button>
            <button @click="saveProfile" class="primary-btn">Save Profile</button>
          </div>
        </div>
      </div>
    `
  }
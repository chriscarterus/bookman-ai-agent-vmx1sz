/**
 * @fileoverview Enhanced post editor component for the Bookman AI platform's community section
 * Supporting rich text editing, media attachments, and real-time collaboration
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill'; // ^2.0.0
import DOMPurify from 'dompurify'; // ^3.0.0
import { useTranslation } from 'react-i18next'; // ^13.0.0
import 'react-quill/dist/quill.snow.css';

// Internal imports
import Button from '../common/Button';
import { communityApi } from '../../api/community';
import type { PostType, CreatePostRequest, UpdatePostRequest } from '../../api/community';
import { ButtonVariant, ComponentSize } from '../common/Button';

// Editor configuration constants
const EDITOR_CONFIG = {
  modules: {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image', 'video'],
      ['clean']
    ],
    clipboard: {
      matchVisual: false
    }
  },
  formats: [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'blockquote', 'code-block',
    'list', 'bullet',
    'link', 'image', 'video'
  ]
};

// Security configuration
const SECURITY_CONFIG = {
  maxContentLength: 10000,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
  sanitizeOptions: {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'blockquote', 'code', 'pre', 'ol', 'ul', 'li', 'a', 'img'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class']
  }
};

interface PostEditorProps {
  initialContent?: string;
  postType: PostType;
  isEditing?: boolean;
  postId?: string;
  onSubmit?: (content: string) => void;
  onCancel?: () => void;
  collaborators?: string[];
  className?: string;
  'aria-label'?: string;
  autoSaveInterval?: number;
}

/**
 * Enhanced post editor component with security, accessibility, and collaboration features
 */
export const PostEditor: React.FC<PostEditorProps> = React.memo(({
  initialContent = '',
  postType,
  isEditing = false,
  postId,
  onSubmit,
  onCancel,
  collaborators = [],
  className = '',
  'aria-label': ariaLabel = 'Post editor',
  autoSaveInterval = 30000
}) => {
  const { t } = useTranslation();
  const [content, setContent] = useState<string>(DOMPurify.sanitize(initialContent));
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<ReactQuill>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  // Initialize auto-save functionality
  useEffect(() => {
    if (autoSaveInterval > 0) {
      autoSaveTimeoutRef.current = setInterval(() => {
        handleAutoSave();
      }, autoSaveInterval);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearInterval(autoSaveTimeoutRef.current);
      }
    };
  }, [content, autoSaveInterval]);

  /**
   * Handles auto-saving of content
   */
  const handleAutoSave = useCallback(async () => {
    if (!content || !isEditing || !postId) return;

    try {
      const sanitizedContent = DOMPurify.sanitize(content, SECURITY_CONFIG.sanitizeOptions);
      await communityApi.updatePost(postId, {
        content: sanitizedContent
      });
      console.debug('Auto-saved content successfully');
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [content, isEditing, postId]);

  /**
   * Handles media file uploads with validation and processing
   */
  const handleMediaUpload = useCallback(async (files: File[]): Promise<string[]> => {
    const validFiles = files.filter(file => 
      SECURITY_CONFIG.allowedFileTypes.includes(file.type) && 
      file.size <= SECURITY_CONFIG.maxFileSize
    );

    if (validFiles.length !== files.length) {
      setError(t('editor.error.invalidFiles'));
      return [];
    }

    try {
      const uploadPromises = validFiles.map(async file => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await communityApi.uploadMedia(formData);
        return response.data.url;
      });

      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Media upload failed:', error);
      setError(t('editor.error.uploadFailed'));
      return [];
    }
  }, [t]);

  /**
   * Handles the submission of the post form
   */
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate content length
      if (content.length > SECURITY_CONFIG.maxContentLength) {
        throw new Error(t('editor.error.contentTooLong'));
      }

      // Sanitize content
      const sanitizedContent = DOMPurify.sanitize(content, SECURITY_CONFIG.sanitizeOptions);

      // Create or update post
      if (isEditing && postId) {
        const updateData: UpdatePostRequest = {
          content: sanitizedContent
        };
        await communityApi.updatePost(postId, updateData);
      } else {
        const createData: CreatePostRequest = {
          type: postType,
          content: sanitizedContent,
          title: '', // Extract from first line or handle separately
        };
        await communityApi.createPost(createData);
      }

      onSubmit?.(sanitizedContent);
    } catch (error) {
      console.error('Post submission failed:', error);
      setError(t('editor.error.submissionFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }, [content, isEditing, postId, postType, onSubmit, t]);

  /**
   * Handles editor content changes
   */
  const handleChange = useCallback((value: string) => {
    setContent(value);
  }, []);

  return (
    <div 
      className={`post-editor ${className}`}
      role="textbox"
      aria-label={ariaLabel}
    >
      {collaborators.length > 0 && (
        <div className="post-editor__collaborators" aria-label={t('editor.collaborators')}>
          {collaborators.map(collaborator => (
            <span key={collaborator} className="post-editor__collaborator-badge">
              {collaborator}
            </span>
          ))}
        </div>
      )}

      <ReactQuill
        ref={editorRef}
        value={content}
        onChange={handleChange}
        modules={EDITOR_CONFIG.modules}
        formats={EDITOR_CONFIG.formats}
        placeholder={t('editor.placeholder')}
        theme="snow"
        className="post-editor__quill"
      />

      {error && (
        <div 
          className="post-editor__error" 
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}

      <div className="post-editor__actions">
        <Button
          variant={ButtonVariant.SECONDARY}
          size={ComponentSize.MEDIUM}
          onClick={onCancel}
          disabled={isSubmitting}
          aria-label={t('editor.cancel')}
        >
          {t('editor.cancel')}
        </Button>
        <Button
          variant={ButtonVariant.PRIMARY}
          size={ComponentSize.MEDIUM}
          onClick={handleSubmit}
          disabled={isSubmitting}
          loading={isSubmitting}
          aria-label={t('editor.submit')}
        >
          {isEditing ? t('editor.update') : t('editor.publish')}
        </Button>
      </div>
    </div>
  );
});

// Display name for debugging
PostEditor.displayName = 'PostEditor';

export default PostEditor;
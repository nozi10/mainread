# Overview

Readify is a sophisticated PDF viewer and reader application built with Next.js that transforms documents into interactive audiobooks with AI-powered features. The platform combines PDF viewing, text-to-speech synthesis, AI-powered document analysis, and user management in a comprehensive reading experience. Users can upload PDFs, listen to them with synchronized highlighting, chat with their documents, generate quizzes, and access summaries and glossaries.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: Next.js 15 with App Router and TypeScript
- **UI Components**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system featuring dark blue primary (#3F51B5) and light blue background (#E8EAF6)
- **PDF Rendering**: React-PDF with PDF.js for client-side PDF viewing and text extraction
- **State Management**: React hooks with custom hook patterns (useReadPage) for complex state logic
- **Responsive Design**: Mobile-first approach with conditional rendering based on screen size

## Backend Architecture
- **API Routes**: Next.js API routes for server actions and RESTful endpoints
- **Authentication**: JWT-based session management with middleware-based route protection
- **Server Actions**: Next.js server actions for form handling and server-side operations
- **File Upload**: Vercel Blob storage for PDF and audio file management
- **Audio Processing**: Server-side audio merging and chunking for large documents

## AI Integration (Genkit Framework)
- **AI Framework**: Google Genkit with multiple AI providers (Google AI, OpenAI)
- **Text-to-Speech**: Multi-provider TTS system supporting OpenAI, Amazon Polly, and VibeVoice
- **Document Analysis**: AI flows for summarization, glossary generation, quiz creation, and chat functionality
- **Speech Synthesis**: Chunked audio generation with speech marks for word-level synchronization
- **Text Processing**: AI-powered text cleaning and formatting for optimal TTS output

## Data Storage
- **Database**: Vercel KV (Redis) for user data, documents metadata, and session storage
- **File Storage**: Vercel Blob for PDF documents and generated audio files
- **Session Storage**: JWT tokens stored in HTTP-only cookies
- **Cache Strategy**: KV-based caching for user sessions and document metadata

## Authentication & Authorization
- **Authentication Method**: Email/password with bcrypt hashing
- **Session Management**: JWT tokens with 24-hour expiration
- **Role-Based Access**: User and Admin roles with middleware-based route protection
- **Admin Features**: User impersonation, user management, document administration
- **Setup Flow**: Token-based account setup for new users

## Audio System Architecture
- **Multi-Provider TTS**: Pluggable architecture supporting multiple TTS providers
- **Chunked Processing**: Large documents split into manageable chunks for audio generation
- **Synchronization**: Speech marks for word/sentence-level highlighting during playback
- **Playback Controls**: Custom audio player with speed control, seeking, and progress tracking
- **Voice Management**: User preferences for voice selection and speaking rate

## User Interface Patterns
- **Sidebar Navigation**: Collapsible sidebar with document library and user controls
- **Modal Dialogs**: For settings, AI features, and administrative functions
- **Drag-and-Drop**: Document organization with folder management
- **Real-time Updates**: Live status updates for audio generation and processing
- **Responsive Layout**: Adaptive layout for different screen sizes and orientations

# External Dependencies

## AI and Machine Learning
- **Google Genkit**: Primary AI framework for orchestrating AI workflows
- **OpenAI API**: Text generation, TTS (voices: alloy, echo, fable, onyx, nova, shimmer), and GPT models
- **Google AI (Gemini)**: Document analysis and text processing with Gemini 2.0 Flash model
- **Amazon Polly**: Advanced TTS with neural voices and speech marks generation
- **VibeVoice**: Additional TTS provider for voice variety

## Storage and Infrastructure
- **Vercel KV**: Redis-compatible key-value store for user data and session management
- **Vercel Blob**: Object storage for PDF documents and generated audio files
- **AWS S3**: Audio file storage for Amazon Polly-generated content
- **Vercel Platform**: Hosting and deployment with optimized Next.js support

## Email Services
- **Resend**: Email delivery service for user onboarding, notifications, and admin communications
- **React Email**: Email template framework for styled email components

## File Processing
- **PDF.js**: Client-side PDF parsing and rendering in the browser
- **bcrypt**: Password hashing for secure user authentication

## Development and Build Tools
- **TypeScript**: Type safety and developer experience
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **React Hook Form**: Form validation and management with Zod schemas
- **Zod**: Runtime type validation and schema definition
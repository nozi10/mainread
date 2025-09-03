
import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Preview,
    Text,
    Hr,
    Section
  } from '@react-email/components';
  import * as React from 'react';
  
  interface AdminReplyEmailProps {
    originalMessage: string;
    replyMessage: string;
  }
  
  export const AdminReplyEmail = ({ originalMessage, replyMessage }: AdminReplyEmailProps) => (
    <Html>
      <Head />
      <Preview>Re: Your Inquiry to Readify</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>A reply from the Readify Team</Heading>
          
          <Section style={replySection}>
             <Text style={{ ...text, whiteSpace: 'pre-wrap' }}>{replyMessage}</Text>
          </Section>
  
          <Hr style={hr} />
  
          <Text style={textMuted}>
            In response to your message:
          </Text>
          <Text style={originalMessageStyles}>
            "{originalMessage}"
          </Text>
  
        </Container>
      </Body>
    </Html>
  );
  
  export default AdminReplyEmail;
  
  const main = {
    backgroundColor: '#f6f9fc',
    padding: '10px 0',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  };
  
  const container = {
    backgroundColor: '#ffffff',
    border: '1px solid #f0f0f0',
    padding: '45px',
  };
  
  const h1 = {
    color: '#3F51B5',
    fontSize: '24px',
    fontWeight: 'bold',
    margin: '0 0 30px 0',
  };
  
  const text = {
    color: '#444',
    fontSize: '16px',
    lineHeight: '24px',
  };

  const textMuted = {
      ...text,
      color: '#888',
      fontSize: '14px',
  }

  const replySection = {
      marginBottom: '30px',
  }
  
  const hr = {
      borderColor: '#e6ebf1',
      margin: '20px 0',
  };

  const originalMessageStyles = {
      ...text,
      fontStyle: 'italic',
      color: '#666',
      borderLeft: '4px solid #e6ebf1',
      paddingLeft: '15px',
  }

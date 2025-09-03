
import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Preview,
    Text,
  } from '@react-email/components';
  import * as React from 'react';
  
  export const RejectionEmail = () => (
    <Html>
      <Head />
      <Preview>Regarding your Readify access request</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Update on Your Readify Access Request</Heading>
          <Text style={text}>
            Hello,
          </Text>
          <Text style={text}>
            Thank you for your interest in Readify. After careful consideration, we are unable to grant access to new users at this time. We have a limited number of spots available and our platform is currently at capacity.
          </Text>
          <Text style={text}>
            We appreciate your understanding and have added you to our waitlist. We will notify you as soon as a spot becomes available.
          </Text>
          <Text style={text}>
            Best regards,
            <br />
            The Readify Team
          </Text>
        </Container>
      </Body>
    </Html>
  );
  
  export default RejectionEmail;
  
  const main = {
    backgroundColor: '#f6f9fc',
    padding: '10px 0',
  };
  
  const container = {
    backgroundColor: '#ffffff',
    border: '1px solid #f0f0f0',
    padding: '45px',
  };
  
  const h1 = {
    color: '#3F51B5',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
    fontSize: '24px',
    fontWeight: 'bold',
    margin: '40px 0',
    padding: '0',
  };
  
  const text = {
    color: '#444',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
    fontSize: '16px',
    lineHeight: '24px',
  };
  

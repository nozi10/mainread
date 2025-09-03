
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Hr,
} from '@react-email/components';
import * as React from 'react';

interface ContactFormEmailProps {
  name: string;
  email: string;
  message: string;
}

export const ContactFormEmail = ({ name, email, message }: ContactFormEmailProps) => (
  <Html>
    <Head />
    <Preview>New Contact Form Submission from {name}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New Inquiry from your Website</Heading>
        <Text style={text}>
          You have received a new message through the contact form on your Readify website.
        </Text>
        <Hr style={hr} />
        <Text style={text}>
          <strong>From:</strong> {name}
        </Text>
        <Text style={text}>
          <strong>Email:</strong> <a href={`mailto:${email}`} style={link}>{email}</a>
        </Text>
        <Hr style={hr} />
        <Heading as="h2" style={h2}>Message:</Heading>
        <Text style={{ ...text, whiteSpace: 'pre-wrap' }}>
          {message}
        </Text>
      </Container>
    </Body>
  </Html>
);

export default ContactFormEmail;

const main = {
  backgroundColor: '#f6f9fc',
  padding: '10px 0',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
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
  padding: '0',
};

const h2 = {
    color: '#333',
    fontSize: '20px',
    fontWeight: 'bold',
    margin: '30px 0 15px 0',
    padding: '0',
}

const text = {
  color: '#444',
  fontSize: '16px',
  lineHeight: '24px',
};

const hr = {
    borderColor: '#e6ebf1',
    margin: '20px 0',
};

const link = {
    color: '#3F51B5',
    textDecoration: 'underline',
}

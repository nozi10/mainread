
import { PollyClient, _Record } from '@aws-sdk/client-polly';
import { S3Client } from '@aws-sdk/client-s3';

// Ensure AWS credentials are configured in environment variables
const awsConfig = {
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
};

if (!awsConfig.region || !awsConfig.credentials.accessKeyId || !awsConfig.credentials.secretAccessKey) {
    console.warn("AWS credentials or region are not fully configured in environment variables. Amazon Polly features may not work.");
}

export const pollyClient = new PollyClient(awsConfig);
export const s3Client = new S3Client(awsConfig);

// This is a subset of voices. You can expand this list as needed.
// To get all voices, you would typically call the DescribeVoicesCommand.
export const amazonVoices: _Record[] = [
    // US English
    { Id: 'Matthew', Gender: 'Male', LanguageCode: 'en-US', LanguageName: 'US English', Name: 'Matthew', SupportedEngines: ['neural', 'standard'] },
    { Id: 'Joanna', Gender: 'Female', LanguageCode: 'en-US', LanguageName: 'US English', Name: 'Joanna', SupportedEngines: ['neural', 'standard'] },
    { Id: 'Ivy', Gender: 'Female', LanguageCode: 'en-US', LanguageName: 'US English', Name: 'Ivy', SupportedEngines: ['neural', 'standard'] },
    { Id: 'Justin', Gender: 'Male', LanguageCode: 'en-US', LanguageName: 'US English', Name: 'Justin', SupportedEngines: ['neural', 'standard'] },
    { Id: 'Kendra', Gender: 'Female', LanguageCode: 'en-US', LanguageName: 'US English', Name: 'Kendra', SupportedEngines: ['neural', 'standard'] },
    { Id: 'Kimberly', Gender: 'Female', LanguageCode: 'en-US', LanguageName: 'US English', Name: 'Kimberly', SupportedEngines: ['neural', 'standard'] },
    { Id: 'Salli', Gender: 'Female', LanguageCode: 'en-US', LanguageName: 'US English', Name: 'Salli', SupportedEngines: ['neural', 'standard'] },
    { Id: 'Joey', Gender: 'Male', LanguageCode: 'en-US', LanguageName: 'US English', Name: 'Joey', SupportedEngines: ['neural', 'standard'] },
    // British English
    { Id: 'Brian', Gender: 'Male', LanguageCode: 'en-GB', LanguageName: 'British English', Name: 'Brian', SupportedEngines: ['neural', 'standard'] },
    { Id: 'Amy', Gender: 'Female', LanguageCode: 'en-GB', LanguageName: 'British English', Name: 'Amy', SupportedEngines: ['neural', 'standard'] },
    { Id: 'Emma', Gender: 'Female', LanguageCode: 'en-GB', LanguageName: 'British English', Name: 'Emma', SupportedEngines: ['neural', 'standard'] },
    // Australian English
    { Id: 'Russell', Gender: 'Male', LanguageCode: 'en-AU', LanguageName: 'Australian English', Name: 'Russell', SupportedEngines: ['standard'] },
    { Id: 'Nicole', Gender: 'Female', LanguageCode: 'en-AU', LanguageName: 'Australian English', Name: 'Nicole', SupportedEngines: ['neural', 'standard'] },
];

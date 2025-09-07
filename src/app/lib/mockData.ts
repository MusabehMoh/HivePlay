/**
 * Mock data provider for YouTube API responses
 * Use this during development to avoid consuming API quota
 */

// Keep track of the mock data state with a variable
let mockDataEnabled = true;
// Keep track of when the setting was last checked
let lastCheckTime = 0;
// Force check interval in milliseconds - check every 2 seconds max
const FORCE_CHECK_INTERVAL = 2000;

// This function will check localStorage for the current setting
export function shouldUseMockData(): boolean {
  if (typeof window === 'undefined') {
    // On server side, we need to rely on what we last knew
    return mockDataEnabled;
  }
  
  try {
    const setting = localStorage.getItem('ytplayer-use-mock-data');
    // If setting exists use it, otherwise default to true
    const value = setting === null ? true : setting === 'true';
    mockDataEnabled = value;
    return value;
  } catch (e) {
    // In case of any errors (e.g. localStorage not available), default to true
    return true;
  }
}

// Export a function that will be called each time we need to check if mock data should be used
// This ensures we always get the freshest setting from localStorage
export function getUseMockData(): boolean {
  const isDev = process.env.NODE_ENV === 'development';
  // Only check localStorage in development mode
  if (!isDev) return false;
  
  // Get the most up-to-date setting
  return getMockDataState();
}

// Setup a single event listener outside the function to avoid multiple listeners
if (typeof window !== 'undefined') {
  window.addEventListener('mock-data-changed', (event: any) => {
    if (event.detail && 'useMockData' in event.detail) {
      mockDataEnabled = event.detail.useMockData;
      lastCheckTime = Date.now();
      console.log('[mockData] State updated via event:', mockDataEnabled);
    }
  });
  
  // Also update when localStorage changes directly
  window.addEventListener('storage', (event) => {
    if (event.key === 'ytplayer-use-mock-data') {
      mockDataEnabled = event.newValue === 'true';
      lastCheckTime = Date.now();
      console.log('[mockData] State updated via storage event:', mockDataEnabled);
    }
  });
  
  // Initialize on load
  mockDataEnabled = shouldUseMockData();
  lastCheckTime = Date.now();
  console.log('[mockData] Initial state:', mockDataEnabled);
}

// API routes can check this function which will return the current state
export function getMockDataState(): boolean {
  const now = Date.now();
  
  // Force re-check from localStorage if it's been a while
  if ((now - lastCheckTime) > FORCE_CHECK_INTERVAL && typeof window !== 'undefined') {
    mockDataEnabled = shouldUseMockData();
    lastCheckTime = now;
    console.log('[mockData] Re-checked state:', mockDataEnabled);
  }
  
  return mockDataEnabled;
}

// For backward compatibility
export const USE_MOCK_DATA = shouldUseMockData();

// Mock search results that closely match the YouTube API structure
export const mockSearchResults = {
  results: [
    {
      kind: "youtube#searchResult",
      etag: "mock_etag_1",
      id: {
        kind: "youtube#video",
        videoId: "dQw4w9WgXcQ" // Rick Astley - Never Gonna Give You Up
      },
      snippet: {
        publishedAt: "2009-10-25T06:57:33Z",
        channelId: "UCuAXFkgsw1L7xaCfnd5JJOw",
        title: "Rick Astley - Never Gonna Give You Up (Official Music Video)",
        description: "The official video for \"Never Gonna Give You Up\" by Rick Astley...",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg",
            width: 120,
            height: 90
          },
          medium: {
            url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
            width: 320,
            height: 180
          },
          high: {
            url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            width: 480,
            height: 360
          }
        },
        channelTitle: "Rick Astley",
        liveBroadcastContent: "none",
        publishTime: "2009-10-25T06:57:33Z"
      },
      contentDetails: {
        duration: "PT3M33S",
        formattedDuration: "3:33"
      },
      statistics: {
        viewCount: "1234567890"
      }
    },
    {
      kind: "youtube#searchResult",
      etag: "mock_etag_2",
      id: {
        kind: "youtube#video",
        videoId: "9bZkp7q19f0" // PSY - Gangnam Style
      },
      snippet: {
        publishedAt: "2012-07-15T07:46:32Z",
        channelId: "UCrDkAvwZum-UTjHmzDI2iIw",
        title: "PSY - Gangnam Style (강남스타일) M/V",
        description: "PSY - Gangnam Style (강남스타일) ⓒ 2012 YG Entertainment Inc.",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/9bZkp7q19f0/default.jpg",
            width: 120,
            height: 90
          },
          medium: {
            url: "https://i.ytimg.com/vi/9bZkp7q19f0/mqdefault.jpg",
            width: 320,
            height: 180
          },
          high: {
            url: "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg",
            width: 480,
            height: 360
          }
        },
        channelTitle: "officialpsy",
        liveBroadcastContent: "none",
        publishTime: "2012-07-15T07:46:32Z"
      },
      contentDetails: {
        duration: "PT4M13S",
        formattedDuration: "4:13"
      },
      statistics: {
        viewCount: "4689574747"
      }
    },
    {
      kind: "youtube#searchResult",
      etag: "mock_etag_3",
      id: {
        kind: "youtube#video",
        videoId: "kJQP7kiw5Fk" // Luis Fonsi - Despacito
      },
      snippet: {
        publishedAt: "2017-01-12T14:00:04Z", 
        channelId: "UCxoq-PAQeAdk_zyg8YS0JqA",
        title: "Luis Fonsi - Despacito ft. Daddy Yankee",
        description: "Despacito ft. Daddy Yankee (Audio)...",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/kJQP7kiw5Fk/default.jpg",
            width: 120,
            height: 90
          },
          medium: {
            url: "https://i.ytimg.com/vi/kJQP7kiw5Fk/mqdefault.jpg",
            width: 320,
            height: 180
          },
          high: {
            url: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
            width: 480,
            height: 360
          }
        },
        channelTitle: "Luis Fonsi",
        liveBroadcastContent: "none",
        publishTime: "2017-01-12T14:00:04Z"
      },
      contentDetails: {
        duration: "PT4M41S",
        formattedDuration: "4:41"
      },
      statistics: {
        viewCount: "7812214845"
      }
    },
    {
      kind: "youtube#searchResult",
      etag: "mock_etag_4",
      id: {
        kind: "youtube#video",
        videoId: "JGwWNGJdvx8" // Ed Sheeran - Shape of You
      },
      snippet: {
        publishedAt: "2017-01-30T05:00:01Z",
        channelId: "UC0C-w0YjGpqDXGB8IHb662A",
        title: "Ed Sheeran - Shape of You (Official Music Video)",
        description: "The official music video for Ed Sheeran - Shape of You...",
        thumbnails: {
          default: {
            url: "https://i.ytimg.com/vi/JGwWNGJdvx8/default.jpg",
            width: 120, 
            height: 90
          },
          medium: {
            url: "https://i.ytimg.com/vi/JGwWNGJdvx8/mqdefault.jpg",
            width: 320,
            height: 180
          },
          high: {
            url: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg",
            width: 480,
            height: 360
          }
        },
        channelTitle: "Ed Sheeran",
        liveBroadcastContent: "none", 
        publishTime: "2017-01-30T05:00:01Z"
      },
      contentDetails: {
        duration: "PT4M24S",
        formattedDuration: "4:24"
      },
      statistics: {
        viewCount: "5637824576"
      }
    }
  ],
  fromCache: true
};

// Mock video details data
export const mockVideoDetails = {
  playbackData: {
    videoDetails: {
      videoId: "dQw4w9WgXcQ",
      title: "Rick Astley - Never Gonna Give You Up (Official Music Video)",
      lengthSeconds: "213",
      keywords: ["Rick Astley", "Never Gonna Give You Up", "music", "video"],
      channelId: "UCuAXFkgsw1L7xaCfnd5JJOw",
      isOwnerViewing: false,
      shortDescription: "The official video for \"Never Gonna Give You Up\" by Rick Astley...",
      isCrawlable: true,
      thumbnail: {
        thumbnails: [
          {
            url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg",
            width: 120,
            height: 90
          },
          {
            url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
            width: 320,
            height: 180
          },
          {
            url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            width: 480,
            height: 360
          }
        ]
      },
      allowRatings: true,
      viewCount: "1234567890",
      author: "Rick Astley",
      isPrivate: false,
      isUnpluggedCorpus: false,
      isLiveContent: false,
      snippet: {
        title: "Rick Astley - Never Gonna Give You Up (Official Music Video)",
        description: "The official video for \"Never Gonna Give You Up\" by Rick Astley...",
        channelTitle: "Rick Astley",
        thumbnails: {
          default: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg" },
          medium: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg" },
          high: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" },
          maxres: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg" }
        }
      }
    }
  },
  fromCache: true
};

// Map of videoIds to mock video details
export const mockVideoDetailsMap: { [videoId: string]: any } = {
  'dQw4w9WgXcQ': { // Rick Astley
    ...mockVideoDetails
  },
  '9bZkp7q19f0': { // PSY - Gangnam Style
    playbackData: {
      videoDetails: {
        ...mockVideoDetails.playbackData.videoDetails,
        videoId: "9bZkp7q19f0",
        title: "PSY - Gangnam Style (강남스타일) M/V",
        lengthSeconds: "253",
        channelId: "UCrDkAvwZum-UTjHmzDI2iIw",
        shortDescription: "PSY - Gangnam Style (강남스타일) ⓒ 2012 YG Entertainment Inc.",
        author: "officialpsy",
        viewCount: "4689574747",
        snippet: {
          title: "PSY - Gangnam Style (강남스타일) M/V",
          description: "PSY - Gangnam Style (강남스타일) ⓒ 2012 YG Entertainment Inc.",
          channelTitle: "officialpsy",
          thumbnails: {
            default: { url: "https://i.ytimg.com/vi/9bZkp7q19f0/default.jpg" },
            medium: { url: "https://i.ytimg.com/vi/9bZkp7q19f0/mqdefault.jpg" },
            high: { url: "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg" },
            maxres: { url: "https://i.ytimg.com/vi/9bZkp7q19f0/maxresdefault.jpg" }
          }
        }
      }
    },
    fromCache: true
  }
};

// Use videoId to get mock video details, fall back to default if not found
export const getMockVideoDetails = (videoId: string) => {
  return mockVideoDetailsMap[videoId] || {
    ...mockVideoDetails,
    playbackData: {
      ...mockVideoDetails.playbackData,
      videoDetails: {
        ...mockVideoDetails.playbackData.videoDetails,
        videoId: videoId,
        title: `Mock Video for ${videoId}`,
        snippet: {
          ...mockVideoDetails.playbackData.videoDetails.snippet,
          title: `Mock Video for ${videoId}`,
          channelTitle: "Mock Channel"
        }
      }
    }
  };
};

// Mock trending videos
export const mockTrendingVideos = {
  results: mockSearchResults.results.slice(0, 10),
  fromCache: true
};

// Mock video suggestions
export const mockVideoSuggestions = {
  results: mockSearchResults.results.slice().reverse(),
  fromCache: true
};
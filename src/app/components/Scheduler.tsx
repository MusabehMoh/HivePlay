import { useState, useEffect } from "react";
import {
  FaClock,
  FaPlus,
  FaTrash,
  FaPlay,
  FaList,
  FaMusic,
  FaEdit,
} from "react-icons/fa";

interface ScheduledItem {
  id: string;
  name: string;
  type: "song" | "playlist";
  scheduledTime: string; // ISO string
  itemId: string; // videoId for songs, playlist name for playlists
  isRecurring: boolean;
  recurringDays?: string[]; // ['monday', 'tuesday', etc.]
  isActive: boolean;
}

interface PlaylistItem {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

interface SchedulerProps {
  playlists: { [key: string]: PlaylistItem[] };
  onSchedulePlay: (itemId: string, type: "song" | "playlist") => void;
  searchResults: any[]; // For scheduling individual songs
}

const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export default function Scheduler({
  playlists,
  onSchedulePlay,
  searchResults,
}: SchedulerProps) {
  const [scheduledItems, setScheduledItems] = useState<ScheduledItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduledItem | null>(null);
  const [lastTriggeredTimes, setLastTriggeredTimes] = useState<{
    [key: string]: string;
  }>({});
  const [formData, setFormData] = useState({
    name: "",
    type: "playlist" as "song" | "playlist",
    itemId: "",
    scheduledTime: "",
    isRecurring: false,
    recurringDays: [] as string[],
  });

  // Load scheduled items from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("scheduledItems");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setScheduledItems(parsed);
      } catch (e) {
        console.error("Failed to parse scheduled items:", e);
      }
    }
  }, []);

  // Save to localStorage whenever scheduledItems changes
  useEffect(() => {
    localStorage.setItem("scheduledItems", JSON.stringify(scheduledItems));
  }, [scheduledItems]);

  // Check for scheduled items every 30 seconds for better precision
  useEffect(() => {
    const checkSchedule = () => {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
      const currentTimeWithSeconds = now.toTimeString().slice(0, 8); // HH:MM:SS format
      const currentDay = now
        .toLocaleDateString("en-US", { weekday: "long" })
        .toLowerCase();
      const currentDateTime = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM

      console.log(
        `[Scheduler] Checking at ${now.toLocaleString()}, Day: ${currentDay}, Time: ${currentTimeWithSeconds}`
      );

      scheduledItems.forEach((item) => {
        if (!item.isActive) {
          console.log(`[Scheduler] Skipping inactive item: ${item.name}`);
          return;
        }

        const scheduledDate = new Date(item.scheduledTime);
        const scheduledTime = scheduledDate.toTimeString().slice(0, 5);
        const scheduledTimeWithSeconds = scheduledDate
          .toTimeString()
          .slice(0, 8);

        console.log(
          `[Scheduler] Checking item: ${item.name}, Type: ${item.type}, Scheduled: ${scheduledTimeWithSeconds}, Current: ${currentTimeWithSeconds}, Recurring: ${item.isRecurring}`
        );

        let shouldPlay = false;

        // Check if we already triggered this item at this exact time
        if (lastTriggeredTimes[item.id] === currentDateTime) {
          console.log(
            `[Scheduler] Already triggered ${item.name} at ${currentDateTime}, skipping`
          );
          return;
        }

        if (item.isRecurring && item.recurringDays) {
          // Check if today is one of the recurring days and time matches
          const isCorrectDay = item.recurringDays.includes(currentDay);
          const isCorrectTime = currentTime === scheduledTime;

          console.log(
            `[Scheduler] Recurring check - Day match: ${isCorrectDay}, Time match: ${isCorrectTime}, Current: ${currentTime}, Scheduled: ${scheduledTime}, Days: ${item.recurringDays.join(
              ","
            )}`
          );

          // For recurring schedules, trigger exactly at the scheduled time
          if (isCorrectDay && isCorrectTime) {
            shouldPlay = true;
            console.log(
              `[Scheduler] ⏰ Recurring schedule triggered for: ${item.name} at ${currentTimeWithSeconds} (scheduled for ${scheduledTimeWithSeconds})`
            );
            // Update last triggered time to prevent multiple triggers in the same minute
            setLastTriggeredTimes((prev) => ({
              ...prev,
              [item.id]: currentDateTime,
            }));
          }
        } else {
          // One-time schedule - check exact date and time (only trigger AFTER scheduled time)
          const scheduledDateTime = scheduledDate.getTime();
          const currentDateTimeMs = now.getTime();
          const timeDiff = currentDateTimeMs - scheduledDateTime; // Positive means current time is after scheduled time

          console.log(
            `[Scheduler] One-time check - Time diff: ${timeDiff}ms (${(
              timeDiff / 1000
            ).toFixed(1)}s), Threshold: 0-10000ms (0-10s after scheduled time)`
          );

          // Only trigger if current time is AFTER scheduled time but within 10 seconds
          if (timeDiff >= 0 && timeDiff <= 10000) {
            shouldPlay = true;
            console.log(
              `[Scheduler] ⏰ One-time schedule triggered for: ${item.name} at ${currentTimeWithSeconds} (scheduled for ${scheduledTimeWithSeconds})`
            );

            // Mark as triggered for this exact minute to prevent re-triggering
            setLastTriggeredTimes((prev) => ({
              ...prev,
              [item.id]: currentDateTime,
            }));

            // Deactivate one-time schedules after playing (with delay to ensure it plays)
            setTimeout(() => {
              setScheduledItems((prev) =>
                prev.map((prevItem) =>
                  prevItem.id === item.id
                    ? { ...prevItem, isActive: false }
                    : prevItem
                )
              );
            }, 1000); // 1 second delay to ensure playback starts
          }
        }

        if (shouldPlay) {
          console.log(
            `[Scheduler] 🎵 Playing scheduled item: ${item.name}, Type: ${item.type}, ItemId: ${item.itemId} at exact time: ${currentTimeWithSeconds}`
          );

          try {
            onSchedulePlay(item.itemId, item.type);
          } catch {
            console.warn(
              `[Scheduler] ⚠️ Autoplay blocked for: ${item.name}. User interaction required.`
            );
            console.warn(
              "Tip: Click anywhere on the page to enable future scheduled playback."
            );
          }
        }
      });
    };

    // Run initial check immediately
    checkSchedule();

    const interval = setInterval(checkSchedule, 10000); // Check every 10 seconds for better precision
    return () => clearInterval(interval);
  }, [scheduledItems, onSchedulePlay, lastTriggeredTimes]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.itemId || !formData.scheduledTime) {
      return;
    }

    if (editingItem) {
      // Update existing item
      const updatedItem: ScheduledItem = {
        ...editingItem,
        name: formData.name.trim(),
        type: formData.type,
        itemId: formData.itemId,
        scheduledTime: formData.scheduledTime,
        isRecurring: formData.isRecurring,
        recurringDays: formData.isRecurring
          ? formData.recurringDays
          : undefined,
      };

      setScheduledItems((prev) =>
        prev.map((item) => (item.id === editingItem.id ? updatedItem : item))
      );
      setEditingItem(null);
    } else {
      // Create new item
      const newScheduledItem: ScheduledItem = {
        id: `schedule-${Date.now()}`,
        name: formData.name.trim(),
        type: formData.type,
        itemId: formData.itemId,
        scheduledTime: formData.scheduledTime,
        isRecurring: formData.isRecurring,
        recurringDays: formData.isRecurring
          ? formData.recurringDays
          : undefined,
        isActive: true,
      };

      setScheduledItems((prev) => [...prev, newScheduledItem]);
    }

    // Reset form
    setFormData({
      name: "",
      type: "playlist",
      itemId: "",
      scheduledTime: "",
      isRecurring: false,
      recurringDays: [],
    });
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    setScheduledItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleEdit = (item: ScheduledItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      type: item.type,
      itemId: item.itemId,
      scheduledTime: item.scheduledTime,
      isRecurring: item.isRecurring,
      recurringDays: item.recurringDays || [],
    });
    setShowAddForm(true);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      type: "playlist",
      itemId: "",
      scheduledTime: "",
      isRecurring: false,
      recurringDays: [],
    });
    setShowAddForm(false);
  };

  const toggleActive = (id: string) => {
    setScheduledItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isActive: !item.isActive } : item
      )
    );
  };

  const handleDayToggle = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      recurringDays: prev.recurringDays.includes(day)
        ? prev.recurringDays.filter((d) => d !== day)
        : [...prev.recurringDays, day],
    }));
  };

  const getItemDisplayName = (item: ScheduledItem) => {
    if (item.type === "playlist") {
      return item.itemId;
    } else {
      const song = searchResults.find(
        (result) => result.id?.videoId === item.itemId
      );
      return song ? song.snippet.title : "Unknown Song";
    }
  };

  const formatScheduleTime = (item: ScheduledItem) => {
    if (item.isRecurring && item.recurringDays) {
      const time = new Date(item.scheduledTime).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const days = item.recurringDays
        .map((day) => day.slice(0, 3).toUpperCase())
        .join(", ");
      return `${time} on ${days}`;
    } else {
      return new Date(item.scheduledTime).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
  };

  return (
    <div className="bg-spotify-dark-base rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FaClock className="text-spotify-green" />
          <h2 className="text-lg font-semibold text-white">Scheduler</h2>
        </div>
        <button
          onClick={() => {
            if (editingItem) {
              handleCancelEdit();
            } else {
              setShowAddForm(!showAddForm);
            }
          }}
          className="p-2 bg-spotify-green text-black rounded-full hover:bg-green-400 transition-colors"
          title={editingItem ? "Cancel edit" : "Add scheduled item"}
        >
          <FaPlus className="w-4 h-4" />
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-spotify-dark-elevated rounded-lg p-4 space-y-4"
        >
          <h3 className="text-lg font-semibold text-white mb-4">
            {editingItem ? "Edit Schedule" : "Add New Schedule"}
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Schedule Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full px-3 py-2 bg-spotify-dark-base border border-gray-600 rounded-md text-white"
              placeholder="Enter schedule name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="playlist"
                  checked={formData.type === "playlist"}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: e.target.value as "song" | "playlist",
                      itemId: "",
                    }))
                  }
                  className="mr-2"
                />
                <FaList className="mr-1" />
                Playlist
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="song"
                  checked={formData.type === "song"}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: e.target.value as "song" | "playlist",
                      itemId: "",
                    }))
                  }
                  className="mr-2"
                />
                <FaMusic className="mr-1" />
                Song
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {formData.type === "playlist" ? "Select Playlist" : "Select Song"}
            </label>
            <select
              value={formData.itemId}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, itemId: e.target.value }))
              }
              className="w-full px-3 py-2 bg-spotify-dark-base border border-gray-600 rounded-md text-white"
              required
            >
              <option value="">Choose {formData.type}...</option>
              {formData.type === "playlist"
                ? Object.keys(playlists).map((playlistName) => (
                    <option key={playlistName} value={playlistName}>
                      {playlistName} ({playlists[playlistName].length} songs)
                    </option>
                  ))
                : searchResults.map((result) => (
                    <option key={result.id?.videoId} value={result.id?.videoId}>
                      {result.snippet.title}
                    </option>
                  ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Scheduled Time
            </label>
            <input
              type="datetime-local"
              value={formData.scheduledTime}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  scheduledTime: e.target.value,
                }))
              }
              className="w-full px-3 py-2 bg-spotify-dark-base border border-gray-600 rounded-md text-white"
              required
            />
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isRecurring}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    isRecurring: e.target.checked,
                    recurringDays: e.target.checked ? prev.recurringDays : [],
                  }))
                }
                className="mr-2"
              />
              Recurring Schedule
            </label>
          </div>

          {formData.isRecurring && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Recurring Days
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayToggle(day)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      formData.recurringDays.includes(day)
                        ? "bg-spotify-green text-black"
                        : "bg-spotify-dark-base text-gray-300 hover:bg-spotify-dark-highlight"
                    }`}
                  >
                    {day.slice(0, 3).toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-spotify-green text-black rounded-md hover:bg-green-400 transition-colors"
            >
              {editingItem ? "Update Schedule" : "Add Schedule"}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {scheduledItems.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No scheduled items</p>
        ) : (
          scheduledItems.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                item.isActive
                  ? "bg-spotify-dark-elevated"
                  : "bg-spotify-dark-elevated/50 opacity-60"
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {item.type === "playlist" ? <FaList /> : <FaMusic />}
                  <span className="font-medium text-white">{item.name}</span>
                  {!item.isActive && (
                    <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">
                      INACTIVE
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-400">
                  {getItemDisplayName(item)}
                </div>
                <div className="text-xs text-gray-500">
                  {formatScheduleTime(item)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleActive(item.id)}
                  className={`p-2 rounded-full transition-colors ${
                    item.isActive
                      ? "text-spotify-green hover:bg-spotify-dark-base"
                      : "text-gray-500 hover:text-gray-300 hover:bg-spotify-dark-base"
                  }`}
                  title={item.isActive ? "Deactivate" : "Activate"}
                >
                  <FaPlay className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleEdit(item)}
                  className="p-2 text-gray-400 hover:text-gray-300 hover:bg-spotify-dark-base rounded-full transition-colors"
                  title="Edit schedule"
                >
                  <FaEdit className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-spotify-dark-base rounded-full transition-colors"
                  title="Delete schedule"
                >
                  <FaTrash className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
